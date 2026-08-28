//! Persistent API and web delivery for Integration Handoff Room.

use axum::{
    body::Body,
    extract::{OriginalUri, Path, State},
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use rand::{distr::Alphanumeric, Rng};
use reqwest::Client;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    env, fs,
    net::SocketAddr,
    path::{Path as FilePath, PathBuf},
    sync::{Arc, Mutex, RwLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tower_http::set_header::SetResponseHeaderLayer;
use tracing::{info, warn};
use uuid::Uuid;

const TENANT_ID: &str = "35c6fe40-0ec0-46b6-98c6-213ad4de6650";
const TENANT_SUBDOMAIN: &str = "sociobotcustomers";
const CLIENT_ID: &str = "25c704f4-465a-47af-80ab-2c489466b697";
const CHECKOUT_URL: &str =
    "https://api.sociobot.in/api/v1/products/integration-handoff-room/checkout";
const MIGRATION: &str = include_str!("../migrations/0001_rooms.up.sql");

#[derive(Clone)]
struct AppState {
    build_sha: String,
    static_dir: PathBuf,
    db: Arc<Mutex<Connection>>,
    limiter: Arc<Mutex<HashMap<String, Bucket>>>,
    auth: AuthMode,
    http: Client,
    public_origin: String,
}

#[derive(Clone)]
enum AuthMode {
    Entra(EntraVerifier),
    #[cfg(test)]
    Test,
}

#[derive(Clone)]
struct EntraVerifier {
    tenant_id: String,
    client_id: String,
    discovery_url: String,
    cache: Arc<RwLock<Option<OidcCache>>>,
    http: Client,
}

#[derive(Clone)]
struct OidcCache {
    issuer: String,
    keys: HashMap<String, DecodingKey>,
    loaded_at: Instant,
}

#[derive(Deserialize)]
struct Discovery {
    issuer: String,
    jwks_uri: String,
}
#[derive(Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}
#[derive(Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
    #[serde(default)]
    kty: String,
}
#[derive(Deserialize)]
struct TokenClaims {
    oid: String,
    tid: String,
    #[serde(default)]
    name: String,
}
#[derive(Clone)]
struct Actor {
    oid: String,
    name: String,
}
struct Bucket {
    tokens: f64,
    last: Instant,
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
    build_sha: String,
}
#[derive(Serialize)]
struct PublicConfig {
    build_sha: String,
    tenant_id: String,
    tenant_subdomain: String,
    client_id: String,
    authority: String,
    checkout_url: &'static str,
    studio_price: &'static str,
}
#[derive(Deserialize)]
struct BootstrapRequest {
    agency_name: String,
}
#[derive(Deserialize)]
struct ImportRequest {
    owner: String,
    repository: String,
    #[serde(default = "default_ref")]
    git_ref: String,
    path: String,
}
#[derive(Deserialize)]
struct RedactRequest {
    fixture: Value,
}
#[derive(Deserialize)]
struct CreateRoomRequest {
    title: String,
    client_name: String,
    repository: String,
    release_ref: String,
    fixture: Value,
    redaction_confirmed: bool,
    #[serde(default)]
    decisions: Vec<DecisionRequest>,
}
#[derive(Deserialize, Serialize)]
struct DecisionRequest {
    text: String,
    owner: String,
}
#[derive(Deserialize)]
struct QuestionRequest {
    author_name: String,
    body: String,
}
#[derive(Deserialize)]
struct AnswerRequest {
    answer: String,
}
#[derive(Deserialize)]
struct AcknowledgeRequest {
    reviewer_name: String,
    confirmed: bool,
    checklist_complete: bool,
}
#[derive(Serialize)]
struct RedactionResult {
    fixture: Value,
    findings: Vec<String>,
}

impl EntraVerifier {
    async fn refresh(&self) -> Result<OidcCache, String> {
        let discovery = self
            .http
            .get(&self.discovery_url)
            .send()
            .await
            .map_err(|_| "Identity discovery is unavailable.")?
            .error_for_status()
            .map_err(|_| "Identity discovery failed.")?
            .json::<Discovery>()
            .await
            .map_err(|_| "Identity discovery was invalid.")?;
        let jwks = self
            .http
            .get(&discovery.jwks_uri)
            .send()
            .await
            .map_err(|_| "Identity signing keys are unavailable.")?
            .error_for_status()
            .map_err(|_| "Identity signing keys failed.")?
            .json::<Jwks>()
            .await
            .map_err(|_| "Identity signing keys were invalid.")?;
        let mut keys = HashMap::new();
        for key in jwks.keys.into_iter().filter(|key| key.kty == "RSA") {
            if let Ok(value) = DecodingKey::from_rsa_components(&key.n, &key.e) {
                keys.insert(key.kid, value);
            }
        }
        if keys.is_empty() {
            return Err("Identity signing keys were empty.".into());
        }
        Ok(OidcCache {
            issuer: discovery.issuer,
            keys,
            loaded_at: Instant::now(),
        })
    }

    async fn verify(&self, token: &str) -> Result<Actor, String> {
        let header = decode_header(token).map_err(|_| "Malformed access token.")?;
        if header.alg != Algorithm::RS256 {
            return Err("Access token must use RS256.".into());
        }
        let kid = header.kid.ok_or("Access token has no key identifier.")?;
        let refresh = self
            .cache
            .read()
            .map_err(|_| "Identity cache failed.")?
            .as_ref()
            .map(|cache| {
                cache.loaded_at.elapsed() >= Duration::from_secs(3600)
                    || !cache.keys.contains_key(&kid)
            })
            .unwrap_or(true);
        if refresh {
            *self.cache.write().map_err(|_| "Identity cache failed.")? =
                Some(self.refresh().await?);
        }
        let cache = self.cache.read().map_err(|_| "Identity cache failed.")?;
        let cache = cache.as_ref().ok_or("Identity cache is empty.")?;
        let key = cache.keys.get(&kid).ok_or("Unknown signing key.")?;
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[self.client_id.as_str()]);
        validation.set_issuer(&[cache.issuer.as_str()]);
        validation.validate_nbf = true;
        let claims = decode::<TokenClaims>(token, key, &validation)
            .map_err(|_| "Invalid or expired access token.")?
            .claims;
        if claims.tid != self.tenant_id {
            return Err("Access token belongs to another tenant.".into());
        }
        Ok(Actor {
            oid: claims.oid,
            name: if claims.name.trim().is_empty() {
                "Agency member".into()
            } else {
                claims.name
            },
        })
    }
}

fn app(state: AppState) -> Router {
    let limited = Router::new()
        .route("/api/config", get(config))
        .route("/api/me/bootstrap", post(bootstrap))
        .route("/api/fixtures/import", post(import_fixture))
        .route("/api/fixtures/redact", post(redact_fixture))
        .route("/api/rooms", get(list_rooms).post(create_room))
        .route("/api/rooms/{room_id}", get(get_room))
        .route("/api/rooms/{room_id}/invite", post(create_invite))
        .route(
            "/api/rooms/{room_id}/questions/{question_id}/answer",
            post(answer_question),
        )
        .route("/api/rooms/{room_id}/export", get(export_room))
        .route("/api/review/{token}", get(review_room))
        .route("/api/review/{token}/questions", post(ask_question))
        .route("/api/review/{token}/acknowledgements", post(acknowledge))
        .fallback(get(serve_web))
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit));
    Router::new().route("/health", get(health)).route("/ready", get(ready)).merge(limited)
        .layer(SetResponseHeaderLayer::if_not_present(HeaderName::from_static("referrer-policy"), HeaderValue::from_static("strict-origin-when-cross-origin")))
        .layer(SetResponseHeaderLayer::if_not_present(HeaderName::from_static("x-content-type-options"), HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(HeaderName::from_static("permissions-policy"), HeaderValue::from_static("camera=(), microphone=(), geolocation=()")))
        .layer(SetResponseHeaderLayer::if_not_present(HeaderName::from_static("content-security-policy"), HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://sociobotcustomers.ciamlogin.com; frame-src 'self' https://sociobotcustomers.ciamlogin.com; base-uri 'self'; form-action 'self' https://api.sociobot.in; frame-ancestors 'none'; object-src 'none'")))
        .with_state(state)
}

async fn rate_limit(State(state): State<AppState>, request: Request<Body>, next: Next) -> Response {
    let ip = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("direct");
    let write = request.method() != Method::GET && request.method() != Method::HEAD;
    // The factory may run three replicas. Per-replica ceilings keep the
    // combined service below the published 20/s, burst-40 client allowance.
    let (rate, burst) = if write { (1.0, 3.0) } else { (6.0, 12.0) };
    let key = format!("{ip}:{}", if write { "write" } else { "read" });
    let allowed = {
        let mut buckets = match state.limiter.lock() {
            Ok(v) => v,
            Err(_) => {
                return err(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "The request limiter is unavailable.",
                )
            }
        };
        let bucket = buckets.entry(key).or_insert_with(|| Bucket {
            tokens: burst,
            last: Instant::now(),
        });
        bucket.tokens = (bucket.tokens + bucket.last.elapsed().as_secs_f64() * rate).min(burst);
        bucket.last = Instant::now();
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            true
        } else {
            false
        }
    };
    if !allowed {
        let mut response = err(
            StatusCode::TOO_MANY_REQUESTS,
            "Too many requests. Try again in one second.",
        );
        response
            .headers_mut()
            .insert(header::RETRY_AFTER, HeaderValue::from_static("1"));
        return response;
    }
    next.run(request).await
}

async fn actor(headers: &HeaderMap, state: &AppState) -> Result<Actor, Response> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|v| !v.is_empty())
        .ok_or_else(unauthorized)?;
    match &state.auth {
        AuthMode::Entra(verifier) => verifier.verify(token).await.map_err(|message| {
            warn!(reason = %message, "access token rejected");
            unauthorized()
        }),
        #[cfg(test)]
        AuthMode::Test => Ok(Actor {
            oid: token.into(),
            name: token.into(),
        }),
    }
}

fn unauthorized() -> Response {
    let mut response = err(
        StatusCode::UNAUTHORIZED,
        "Sign in with your Sociobot account to continue.",
    );
    response
        .headers_mut()
        .insert(header::WWW_AUTHENTICATE, HeaderValue::from_static("Bearer"));
    response
}
fn err(status: StatusCode, message: &str) -> Response {
    (status, Json(json!({ "error": message }))).into_response()
}
fn valid(value: &str, field: &str, max: usize) -> Result<String, Response> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > max {
        Err(err(
            StatusCode::UNPROCESSABLE_ENTITY,
            &format!("{field} must be between 1 and {max} characters."),
        ))
    } else {
        Ok(value.into())
    }
}

async fn health(State(state): State<AppState>) -> Json<Health> {
    Json(Health {
        status: "ok",
        build_sha: state.build_sha,
    })
}
async fn ready(State(state): State<AppState>) -> Response {
    if state
        .db
        .lock()
        .ok()
        .and_then(|db| db.query_row("SELECT 1", [], |_| Ok(())).ok())
        .is_some()
    {
        Json(Health {
            status: "ready",
            build_sha: state.build_sha,
        })
        .into_response()
    } else {
        err(
            StatusCode::SERVICE_UNAVAILABLE,
            "The room database is not ready.",
        )
    }
}
async fn config(State(state): State<AppState>) -> Json<PublicConfig> {
    let tenant_id = env::var("ENTRA_TENANT_ID").unwrap_or_else(|_| TENANT_ID.into());
    let tenant_subdomain =
        env::var("ENTRA_TENANT_SUBDOMAIN").unwrap_or_else(|_| TENANT_SUBDOMAIN.into());
    Json(PublicConfig {
        build_sha: state.build_sha,
        tenant_id: tenant_id.clone(),
        tenant_subdomain: tenant_subdomain.clone(),
        client_id: env::var("ENTRA_CLIENT_ID").unwrap_or_else(|_| CLIENT_ID.into()),
        authority: format!("https://{tenant_subdomain}.ciamlogin.com/{tenant_id}/"),
        checkout_url: CHECKOUT_URL,
        studio_price: "$79 USD per agency each month",
    })
}

fn membership(db: &Connection, oid: &str) -> rusqlite::Result<Option<(String, String)>> {
    db.query_row("SELECT a.id,a.name FROM agencies a JOIN memberships m ON m.agency_id=a.id JOIN users u ON u.id=m.user_id WHERE u.entra_oid=?1 LIMIT 1", [oid], |r| Ok((r.get(0)?, r.get(1)?))).optional()
}

async fn bootstrap(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<BootstrapRequest>,
) -> Response {
    let actor = match actor(&headers, &state).await {
        Ok(v) => v,
        Err(r) => return r,
    };
    let agency_name = match valid(&body.agency_name, "Agency name", 100) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let mut db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    if let Ok(Some((id, name))) = membership(&db, &actor.oid) {
        return Json(json!({"agency":{"id":id,"name":name,"role":"owner"},"member":actor.name}))
            .into_response();
    }
    let user_id = Uuid::new_v4().to_string();
    let agency_id = Uuid::new_v4().to_string();
    let tx = match db.transaction() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "The agency could not be created.",
            )
        }
    };
    let saved = tx
        .execute(
            "INSERT INTO users(id,entra_oid,display_name) VALUES(?1,?2,?3)",
            params![user_id, actor.oid, actor.name],
        )
        .and_then(|_| {
            tx.execute(
                "INSERT INTO agencies(id,name) VALUES(?1,?2)",
                params![agency_id, agency_name],
            )
        })
        .and_then(|_| {
            tx.execute(
                "INSERT INTO memberships(agency_id,user_id,role) VALUES(?1,?2,'owner')",
                params![agency_id, user_id],
            )
        })
        .is_ok()
        && tx.commit().is_ok();
    if !saved {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The agency could not be created.",
        );
    }
    (StatusCode::CREATED, Json(json!({"agency":{"id":agency_id,"name":agency_name,"role":"owner"},"member":actor.name}))).into_response()
}

async fn agency_for(headers: &HeaderMap, state: &AppState) -> Result<(Actor, String), Response> {
    let actor = actor(headers, state).await?;
    let db = state.db.lock().map_err(|_| {
        err(
            StatusCode::SERVICE_UNAVAILABLE,
            "The room database is unavailable.",
        )
    })?;
    membership(&db, &actor.oid)
        .map_err(|_| {
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "The agency could not be read.",
            )
        })?
        .map(|(id, _)| (actor, id))
        .ok_or_else(|| {
            err(
                StatusCode::FORBIDDEN,
                "Create your agency workspace before creating a room.",
            )
        })
}

fn safe_git(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 160
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/'))
        && !value.contains("..")
}
fn default_ref() -> String {
    "main".into()
}

async fn import_fixture(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ImportRequest>,
) -> Response {
    if let Err(r) = agency_for(&headers, &state).await {
        return r;
    }
    if !safe_git(&body.owner)
        || !safe_git(&body.repository)
        || !safe_git(&body.git_ref)
        || !safe_git(&body.path)
    {
        return err(StatusCode::UNPROCESSABLE_ENTITY, "Use a GitHub owner, repository, ref, and JSON path without spaces or parent-directory segments.");
    }
    let url = format!(
        "https://raw.githubusercontent.com/{}/{}/{}/{}",
        body.owner, body.repository, body.git_ref, body.path
    );
    let response =
        match state
            .http
            .get(url)
            .header(header::USER_AGENT, "integration-handoff-room/0.2")
            .send()
            .await
        {
            Ok(v) if v.status().is_success() => v,
            _ => return err(
                StatusCode::BAD_GATEWAY,
                "GitHub did not return that JSON file. Check the public repository, ref, and path.",
            ),
        };
    let bytes = match response.bytes().await {
        Ok(v) if v.len() <= 256 * 1024 => v,
        _ => {
            return err(
                StatusCode::PAYLOAD_TOO_LARGE,
                "The selected fixture must be JSON and no larger than 256 KB.",
            )
        }
    };
    let fixture = match serde_json::from_slice(&bytes) {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::UNPROCESSABLE_ENTITY,
                "The selected repository file is not valid JSON.",
            )
        }
    };
    let redacted = sanitize(fixture);
    Json(json!({"repository":format!("{}/{}",body.owner,body.repository),"release_ref":body.git_ref,"path":body.path,"fixture":redacted.fixture,"findings":redacted.findings})).into_response()
}

async fn redact_fixture(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RedactRequest>,
) -> Response {
    if let Err(r) = agency_for(&headers, &state).await {
        return r;
    }
    Json(sanitize(body.fixture)).into_response()
}

fn sanitize(mut fixture: Value) -> RedactionResult {
    let mut findings = Vec::new();
    redact(&mut fixture, "$", &mut findings);
    RedactionResult { fixture, findings }
}
fn redact(value: &mut Value, path: &str, findings: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                let lower = key.to_ascii_lowercase().replace('-', "_");
                let next = format!("{path}.{key}");
                if [
                    "authorization",
                    "proxy_authorization",
                    "cookie",
                    "set_cookie",
                    "password",
                    "client_secret",
                    "private_key",
                    "access_token",
                    "refresh_token",
                    "api_key",
                ]
                .iter()
                .any(|s| lower == *s || lower.ends_with(&format!("_{s}")))
                {
                    *child = Value::String("[REDACTED]".into());
                    findings.push(format!("Removed a secret-like value at {next}."));
                } else {
                    redact(child, &next, findings);
                }
            }
        }
        Value::Array(items) => {
            for (index, child) in items.iter_mut().enumerate() {
                redact(child, &format!("{path}[{index}]"), findings)
            }
        }
        Value::String(text) => {
            let lower = text.to_ascii_lowercase();
            let suspicious = (text.split('.').count() == 3 && text.len() > 48)
                || lower.starts_with("bearer ")
                || lower.starts_with("basic ")
                || lower.starts_with("ghp_")
                || lower.starts_with("github_pat_")
                || lower.starts_with("sk-")
                || text.contains("-----BEGIN PRIVATE KEY-----")
                || (text.len() >= 40
                    && text
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || "_-".contains(c))
                    && text.chars().any(|c| c.is_ascii_digit())
                    && text.chars().any(|c| c.is_ascii_alphabetic()));
            if suspicious {
                *text = "[REDACTED]".into();
                findings.push(format!("Removed a secret-like value at {path}."));
            }
        }
        _ => {}
    }
}

fn room_json(
    db: &Connection,
    room_id: &str,
    agency_id: Option<&str>,
) -> rusqlite::Result<Option<Value>> {
    let sql = if agency_id.is_some() {
        "SELECT id,title,client_name,repository,release_ref,revision,fixture_json,redaction_json,checklist_json,decisions_json,created_at,updated_at FROM rooms WHERE id=?1 AND agency_id=?2"
    } else {
        "SELECT id,title,client_name,repository,release_ref,revision,fixture_json,redaction_json,checklist_json,decisions_json,created_at,updated_at FROM rooms WHERE id=?1"
    };
    let map = |r: &rusqlite::Row<'_>| -> rusqlite::Result<Value> {
        let fixture: String = r.get(6)?;
        let findings: String = r.get(7)?;
        let checklist: String = r.get(8)?;
        let decisions: String = r.get(9)?;
        Ok(
            json!({"id":r.get::<_,String>(0)? ,"title":r.get::<_,String>(1)? ,"client_name":r.get::<_,String>(2)? ,"repository":r.get::<_,String>(3)? ,"release_ref":r.get::<_,String>(4)? ,"revision":r.get::<_,i64>(5)? ,"fixture":serde_json::from_str::<Value>(&fixture).unwrap_or(Value::Null),"redaction_findings":serde_json::from_str::<Value>(&findings).unwrap_or(json!([])),"checklist":serde_json::from_str::<Value>(&checklist).unwrap_or(json!([])),"decisions":serde_json::from_str::<Value>(&decisions).unwrap_or(json!([])),"created_at":r.get::<_,String>(10)? ,"updated_at":r.get::<_,String>(11)?}),
        )
    };
    match agency_id {
        Some(id) => db.query_row(sql, params![room_id, id], map).optional(),
        None => db.query_row(sql, [room_id], map).optional(),
    }
}

fn related(db: &Connection, room_id: &str, room: &mut Value) -> rusqlite::Result<()> {
    let mut statement=db.prepare("SELECT id,author_type,author_name,body,answer,created_at FROM questions WHERE room_id=?1 ORDER BY created_at,id")?;
    let questions:Vec<Value>=statement.query_map([room_id],|r|Ok(json!({"id":r.get::<_,String>(0)?,"author_type":r.get::<_,String>(1)?,"author_name":r.get::<_,String>(2)?,"body":r.get::<_,String>(3)?,"answer":r.get::<_,Option<String>>(4)?,"created_at":r.get::<_,String>(5)?})))?.filter_map(Result::ok).collect();
    let acknowledgement:Option<Value>=db.query_row("SELECT revision,reviewer_name,acknowledged_at,disclaimer_version FROM acknowledgements WHERE room_id=?1 ORDER BY revision DESC LIMIT 1",[room_id],|r|Ok(json!({"revision":r.get::<_,i64>(0)?,"reviewer_name":r.get::<_,String>(1)?,"acknowledged_at":r.get::<_,String>(2)?,"disclaimer_version":r.get::<_,String>(3)?}))).optional()?;
    room["questions"] = json!(questions);
    room["acknowledgement"] = acknowledgement.unwrap_or(Value::Null);
    Ok(())
}

async fn list_rooms(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let (_, agency_id) = match agency_for(&headers, &state).await {
        Ok(v) => v,
        Err(r) => return r,
    };
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    let mut statement=match db.prepare("SELECT id,title,client_name,repository,release_ref,revision,updated_at FROM rooms WHERE agency_id=?1 ORDER BY updated_at DESC"){Ok(v)=>v,Err(_)=>return err(StatusCode::INTERNAL_SERVER_ERROR,"Rooms could not be read.")};
    let rooms:Vec<Value>=statement.query_map([agency_id],|r|Ok(json!({"id":r.get::<_,String>(0)?,"title":r.get::<_,String>(1)?,"client_name":r.get::<_,String>(2)?,"repository":r.get::<_,String>(3)?,"release_ref":r.get::<_,String>(4)?,"revision":r.get::<_,i64>(5)?,"updated_at":r.get::<_,String>(6)?}))).map(|rows|rows.filter_map(Result::ok).collect()).unwrap_or_default();
    Json(json!({"rooms":rooms})).into_response()
}

async fn create_room(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateRoomRequest>,
) -> Response {
    let (_, agency_id) = match agency_for(&headers, &state).await {
        Ok(v) => v,
        Err(r) => return r,
    };
    let title = match valid(&body.title, "Room title", 120) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let client = match valid(&body.client_name, "Client name", 120) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let repository = match valid(&body.repository, "Repository", 240) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let release_ref = match valid(&body.release_ref, "Release ref", 160) {
        Ok(v) => v,
        Err(r) => return r,
    };
    if body.fixture.to_string().len() > 256 * 1024 {
        return err(
            StatusCode::PAYLOAD_TOO_LARGE,
            "The fixture must be no larger than 256 KB.",
        );
    }
    let redacted = sanitize(body.fixture);
    if !redacted.findings.is_empty() && !body.redaction_confirmed {
        return(StatusCode::UNPROCESSABLE_ENTITY,Json(json!({"error":"Review and confirm the redaction report before creating this room.","fixture":redacted.fixture,"findings":redacted.findings}))).into_response();
    }
    let room_id = Uuid::new_v4().to_string();
    let checklist = json!([{"id":"fixture","label":"I reviewed the selected fixture.","required":true},{"id":"decisions","label":"I reviewed the release decisions and owners.","required":true},{"id":"questions","label":"My open questions are recorded in this room.","required":true}]);
    let mut decisions = Vec::new();
    for decision in body.decisions {
        let text = match valid(&decision.text, "Decision", 1000) {
            Ok(value) => value,
            Err(response) => return response,
        };
        let owner = match valid(&decision.owner, "Decision owner", 120) {
            Ok(value) => value,
            Err(response) => return response,
        };
        decisions.push(json!({"version":1,"text":text,"owner":owner}));
    }
    if decisions.is_empty() {
        return err(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Add at least one release decision with a named owner.",
        );
    }
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    if db.execute("INSERT INTO rooms(id,agency_id,title,client_name,repository,release_ref,fixture_json,redaction_json,checklist_json,decisions_json)VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",params![room_id,agency_id,title,client,repository,release_ref,redacted.fixture.to_string(),json!(redacted.findings).to_string(),checklist.to_string(),json!(decisions).to_string()]).is_err(){return err(StatusCode::INTERNAL_SERVER_ERROR,"The room could not be saved.")}
    let mut room = room_json(&db, &room_id, Some(&agency_id))
        .ok()
        .flatten()
        .unwrap_or(Value::Null);
    let _ = related(&db, &room_id, &mut room);
    (StatusCode::CREATED, Json(room)).into_response()
}

async fn get_room(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(room_id): Path<String>,
) -> Response {
    let (_, agency_id) = match agency_for(&headers, &state).await {
        Ok(v) => v,
        Err(r) => return r,
    };
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    match room_json(&db, &room_id, Some(&agency_id)) {
        Ok(Some(mut room)) => {
            let _ = related(&db, &room_id, &mut room);
            Json(room).into_response()
        }
        Ok(None) => err(
            StatusCode::NOT_FOUND,
            "That room does not exist in your agency.",
        ),
        Err(_) => err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The room could not be read.",
        ),
    }
}

fn random_token() -> String {
    rand::rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect()
}
fn hash(token: &str) -> String {
    format!("{:x}", Sha256::digest(token.as_bytes()))
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

async fn create_invite(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(room_id): Path<String>,
) -> Response {
    let (_, agency_id) = match agency_for(&headers, &state).await {
        Ok(v) => v,
        Err(r) => return r,
    };
    let token = random_token();
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    if room_json(&db, &room_id, Some(&agency_id))
        .ok()
        .flatten()
        .is_none()
    {
        return err(
            StatusCode::NOT_FOUND,
            "That room does not exist in your agency.",
        );
    };
    let expiry = now() + 604800;
    if db
        .execute(
            "INSERT INTO review_invites(id,room_id,token_hash,expires_at)VALUES(?1,?2,?3,?4)",
            params![Uuid::new_v4().to_string(), room_id, hash(&token), expiry],
        )
        .is_err()
    {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The private review link could not be created.",
        );
    };
    (StatusCode::CREATED,Json(json!({"review_url":format!("{}/review/{}",state.public_origin.trim_end_matches('/'),token),"expires_at":expiry}))).into_response()
}

fn room_for_token(db: &Connection, token: &str) -> rusqlite::Result<Option<(String, Value)>> {
    let room_id:Option<String>=db.query_row("SELECT room_id FROM review_invites WHERE token_hash=?1 AND revoked_at IS NULL AND expires_at>?2",params![hash(token),now()],|r|r.get(0)).optional()?;
    match room_id {
        Some(id) => Ok(room_json(db, &id, None)?.map(|room| (id, room))),
        None => Ok(None),
    }
}

async fn review_room(State(state): State<AppState>, Path(token): Path<String>) -> Response {
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    match room_for_token(&db, &token) {
        Ok(Some((id, mut room))) => {
            let _ = related(&db, &id, &mut room);
            Json(room).into_response()
        }
        Ok(None) => err(
            StatusCode::NOT_FOUND,
            "This private review link is invalid, expired, or revoked.",
        ),
        Err(_) => err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The review room could not be read.",
        ),
    }
}

async fn ask_question(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(body): Json<QuestionRequest>,
) -> Response {
    let author = match valid(&body.author_name, "Reviewer name", 80) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let question = match valid(&body.body, "Question", 1000) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    let room_id = match room_for_token(&db, &token) {
        Ok(Some((id, _))) => id,
        Ok(None) => {
            return err(
                StatusCode::NOT_FOUND,
                "This private review link is invalid, expired, or revoked.",
            )
        }
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "The review room could not be read.",
            )
        }
    };
    let id = Uuid::new_v4().to_string();
    if db.execute("INSERT INTO questions(id,room_id,author_type,author_name,body)VALUES(?1,?2,'client',?3,?4)",params![id,room_id,author,question]).is_err(){return err(StatusCode::INTERNAL_SERVER_ERROR,"The question could not be saved.")};
    (
        StatusCode::CREATED,
        Json(json!({"id":id,"author_name":author,"body":question,"answer":null})),
    )
        .into_response()
}

async fn answer_question(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((room_id, question_id)): Path<(String, String)>,
    Json(body): Json<AnswerRequest>,
) -> Response {
    let (_, agency_id) = match agency_for(&headers, &state).await {
        Ok(v) => v,
        Err(r) => return r,
    };
    let answer = match valid(&body.answer, "Answer", 2000) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    let changed=db.execute("UPDATE questions SET answer=?1 WHERE id=?2 AND room_id=?3 AND EXISTS(SELECT 1 FROM rooms WHERE id=?3 AND agency_id=?4)",params![answer,question_id,room_id,agency_id]).unwrap_or(0);
    if changed == 0 {
        err(
            StatusCode::NOT_FOUND,
            "That question does not exist in your agency room.",
        )
    } else {
        Json(json!({"saved":true})).into_response()
    }
}

async fn acknowledge(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(body): Json<AcknowledgeRequest>,
) -> Response {
    if !body.confirmed || !body.checklist_complete {
        return err(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Complete the checklist and confirm the review before acknowledging this revision.",
        );
    };
    let reviewer = match valid(&body.reviewer_name, "Reviewer name", 80) {
        Ok(v) => v,
        Err(r) => return r,
    };
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    let (room_id, room) = match room_for_token(&db, &token) {
        Ok(Some(v)) => v,
        Ok(None) => {
            return err(
                StatusCode::NOT_FOUND,
                "This private review link is invalid, expired, or revoked.",
            )
        }
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "The review room could not be read.",
            )
        }
    };
    let revision = room["revision"].as_i64().unwrap_or(1);
    match db.execute("INSERT INTO acknowledgements(id,room_id,revision,reviewer_name,disclaimer_version)VALUES(?1,?2,?3,?4,'2026-08-review-v1')",params![Uuid::new_v4().to_string(),room_id,revision,reviewer]){Ok(_)=>(StatusCode::CREATED,Json(json!({"reviewer_name":reviewer,"revision":revision,"notice":"This acknowledgement records a review. It is not a contract or legal signature."}))).into_response(),Err(_)=>err(StatusCode::CONFLICT,"This room revision already has an acknowledgement.")}
}

async fn export_room(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(room_id): Path<String>,
) -> Response {
    let (_, agency_id) = match agency_for(&headers, &state).await {
        Ok(v) => v,
        Err(r) => return r,
    };
    let db = match state.db.lock() {
        Ok(v) => v,
        Err(_) => {
            return err(
                StatusCode::SERVICE_UNAVAILABLE,
                "The room database is unavailable.",
            )
        }
    };
    match room_json(&db, &room_id, Some(&agency_id)) {
        Ok(Some(mut room)) => {
            let _ = related(&db, &room_id, &mut room);
            Json(json!({"schema_version":1,"exported_at_unix":now(),"room":room,"notice":"An acknowledgement records a review. It is not a contract or legal signature."})).into_response()
        }
        Ok(None) => err(
            StatusCode::NOT_FOUND,
            "That room does not exist in your agency.",
        ),
        Err(_) => err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The room export could not be created.",
        ),
    }
}

fn browser_route(path: &str) -> bool {
    matches!(
        path,
        "/" | "/demo"
            | "/privacy"
            | "/terms"
            | "/rooms"
            | "/rooms/new"
            | "/settings/billing"
            | "/auth/callback"
    ) || path.starts_with("/rooms/")
        || path.starts_with("/review/")
}
async fn serve_web(State(state): State<AppState>, OriginalUri(uri): OriginalUri) -> Response {
    let request_path = uri.path();
    let relative = request_path.trim_start_matches('/');
    let candidate = state.static_dir.join(relative);
    let safe = !relative.is_empty() && !relative.contains("..") && candidate.is_file();
    let (path, status, cache) = if safe {
        (
            candidate,
            StatusCode::OK,
            if request_path.starts_with("/assets/") {
                "public, max-age=31536000, immutable"
            } else {
                "public, max-age=3600"
            },
        )
    } else {
        (
            state.static_dir.join("index.html"),
            if browser_route(request_path) {
                StatusCode::OK
            } else {
                StatusCode::NOT_FOUND
            },
            "no-cache",
        )
    };
    let bytes = match tokio::fs::read(&path).await {
        Ok(v) => v,
        Err(_) => return err(StatusCode::NOT_FOUND, "The requested page was not found."),
    };
    let mime = mime_guess::from_path(&path).first_or_octet_stream();
    let etag = format!("\"{:x}\"", Sha256::digest(&bytes));
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, mime.as_ref())
        .header(header::CACHE_CONTROL, cache)
        .header(header::ETAG, etag)
        .body(Body::from(bytes))
        .unwrap_or_else(|_| {
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "The page could not be served.",
            )
        })
}

fn configured_port() -> u16 {
    env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8080)
}
fn data_dir() -> (PathBuf, &'static str) {
    match env::var_os("DATA_DIR") {
        Some(v) => (PathBuf::from(v), "supplied"),
        None => (PathBuf::from("./data"), "generated default"),
    }
}
fn open_db(path: &FilePath) -> Result<Connection, Box<dyn std::error::Error>> {
    fs::create_dir_all(path)?;
    let db = Connection::open(path.join("handoff-room.sqlite3"))?;
    db.execute_batch(MIGRATION)?;
    Ok(db)
}
async fn shutdown() {
    let ctrl = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler")
    };
    #[cfg(unix)]
    let term = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! {_=ctrl=>{},_=term=>{}}
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();
    let build_sha = env::var("BUILD_SHA").unwrap_or_else(|_| "dev".into());
    let port = configured_port();
    let static_dir = env::var_os("STATIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/app/dist"));
    let (data_dir, data_source) = data_dir();
    let tenant_id = env::var("ENTRA_TENANT_ID").unwrap_or_else(|_| TENANT_ID.into());
    let subdomain = env::var("ENTRA_TENANT_SUBDOMAIN").unwrap_or_else(|_| TENANT_SUBDOMAIN.into());
    let client_id = env::var("ENTRA_CLIENT_ID").unwrap_or_else(|_| CLIENT_ID.into());
    let http = Client::builder().timeout(Duration::from_secs(12)).build()?;
    let auth = AuthMode::Entra(EntraVerifier {
        tenant_id: tenant_id.clone(),
        client_id,
        discovery_url: format!(
            "https://{subdomain}.ciamlogin.com/{tenant_id}/v2.0/.well-known/openid-configuration"
        ),
        cache: Arc::new(RwLock::new(None)),
        http: http.clone(),
    });
    let state = AppState {
        build_sha,
        static_dir,
        db: Arc::new(Mutex::new(open_db(&data_dir)?)),
        limiter: Arc::new(Mutex::new(HashMap::new())),
        auth,
        http,
        public_origin: env::var("PUBLIC_ORIGIN")
            .unwrap_or_else(|_| "https://integration-handoff-room.sociobot.in".into()),
    };
    info!(port,build_sha=%state.build_sha,static_dir=%state.static_dir.display(),data_dir=%data_dir.display(),data_config=data_source,auth_config="Sociobot Entra defaults with optional env overrides","starting integration handoff room service");
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).await?;
    axum::serve(
        listener,
        app(state).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown())
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use tower::ServiceExt;

    fn state() -> (AppState, PathBuf) {
        let root = env::temp_dir().join(format!("handoff-room-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("index.html"), "<main>shell</main>").unwrap();
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(MIGRATION).unwrap();
        (
            AppState {
                build_sha: "test-build".into(),
                static_dir: root.clone(),
                db: Arc::new(Mutex::new(db)),
                limiter: Arc::new(Mutex::new(HashMap::new())),
                auth: AuthMode::Test,
                http: Client::new(),
                public_origin: "https://example.test".into(),
            },
            root,
        )
    }
    async fn request(
        router: Router,
        method: Method,
        uri: &str,
        token: Option<&str>,
        value: Value,
    ) -> Response {
        let mut b = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json")
            .header("x-forwarded-for", token.unwrap_or("review-client"));
        if let Some(token) = token {
            b = b.header(header::AUTHORIZATION, format!("Bearer {token}"))
        };
        router
            .oneshot(b.body(Body::from(value.to_string())).unwrap())
            .await
            .unwrap()
    }

    #[test]
    fn claim_fixture_redaction_blocks_secret_corpus() {
        let result = sanitize(
            json!({"Authorization":"Bearer live-secret","nested":{"api_key":"sk-live-value","safe":"invoice-2048"},"jwt":"eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature-signature-signature"}),
        );
        let text = result.fixture.to_string();
        assert_eq!(result.findings.len(), 3);
        assert!(!text.contains("live-secret"));
        assert!(!text.contains("sk-live"));
        assert!(!text.contains("eyJhbGci"));
        assert!(text.contains("invoice-2048"));
    }

    #[tokio::test]
    async fn claim_api_rate_limit_uses_forwarded_ip_and_retry_after() {
        let (state, root) = state();
        let router = app(state);
        let mut limited = None;
        for _ in 0..45 {
            let response = router
                .clone()
                .oneshot(
                    Request::get("/demo")
                        .header("x-forwarded-for", "203.0.113.8, 10.0.0.2")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            if response.status() == StatusCode::TOO_MANY_REQUESTS {
                limited = Some(response);
                break;
            }
        }
        let response = limited.expect("burst allowance must be enforced");
        assert_eq!(response.headers().get(header::RETRY_AFTER).unwrap(), "1");
        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn real_room_persists_is_tenant_scoped_and_has_private_review() {
        let (state, root) = state();
        let router = app(state);
        let boot = request(
            router.clone(),
            Method::POST,
            "/api/me/bootstrap",
            Some("owner-a"),
            json!({"agency_name":"Atlas Works"}),
        )
        .await;
        assert_eq!(boot.status(), StatusCode::CREATED);
        let room=request(router.clone(),Method::POST,"/api/rooms",Some("owner-a"),json!({"title":"Checkout handoff","client_name":"Northstar","repository":"atlas/payments","release_ref":"v1.2.0","fixture":{"authorization":"Bearer secret","status":"paid"},"redaction_confirmed":true,"decisions":[{"text":"Retry stops after three checks.","owner":"Dara Singh"}]})).await;
        assert_eq!(room.status(), StatusCode::CREATED);
        let room: Value =
            serde_json::from_slice(&to_bytes(room.into_body(), usize::MAX).await.unwrap()).unwrap();
        assert_eq!(room["fixture"]["authorization"], "[REDACTED]");
        let id = room["id"].as_str().unwrap();
        let reload = router
            .clone()
            .oneshot(
                Request::get(format!("/api/rooms/{id}"))
                    .header(header::AUTHORIZATION, "Bearer owner-a")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(reload.status(), StatusCode::OK);
        let second = request(
            router.clone(),
            Method::POST,
            "/api/me/bootstrap",
            Some("owner-b"),
            json!({"agency_name":"Other Agency"}),
        )
        .await;
        assert_eq!(second.status(), StatusCode::CREATED);
        let denied = router
            .clone()
            .oneshot(
                Request::get(format!("/api/rooms/{id}"))
                    .header(header::AUTHORIZATION, "Bearer owner-b")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(denied.status(), StatusCode::NOT_FOUND);
        let invite = request(
            router.clone(),
            Method::POST,
            &format!("/api/rooms/{id}/invite"),
            Some("owner-a"),
            json!({}),
        )
        .await;
        let invite: Value =
            serde_json::from_slice(&to_bytes(invite.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        let token = invite["review_url"]
            .as_str()
            .unwrap()
            .rsplit('/')
            .next()
            .unwrap();
        let review = router
            .clone()
            .oneshot(
                Request::get(format!("/api/review/{token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(review.status(), StatusCode::OK);
        let question = request(
            router.clone(),
            Method::POST,
            &format!("/api/review/{token}/questions"),
            None,
            json!({"author_name":"Morgan","body":"When does retry stop?"}),
        )
        .await;
        assert_eq!(question.status(), StatusCode::CREATED);
        let acknowledgement = request(
            router.clone(),
            Method::POST,
            &format!("/api/review/{token}/acknowledgements"),
            None,
            json!({"reviewer_name":"Morgan","confirmed":true,"checklist_complete":true}),
        )
        .await;
        assert_eq!(acknowledgement.status(), StatusCode::CREATED);
        let export = router
            .clone()
            .oneshot(
                Request::get(format!("/api/rooms/{id}/export"))
                    .header(header::AUTHORIZATION, "Bearer owner-a")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(export.status(), StatusCode::OK);
        let export: Value =
            serde_json::from_slice(&to_bytes(export.into_body(), usize::MAX).await.unwrap())
                .unwrap();
        assert_eq!(
            export["room"]["questions"][0]["body"],
            "When does retry stop?"
        );
        assert_eq!(export["room"]["acknowledgement"]["reviewer_name"], "Morgan");
        assert_eq!(export["room"]["decisions"][0]["owner"], "Dara Singh");
        let bad = router
            .clone()
            .oneshot(
                Request::get("/api/review/bad-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad.status(), StatusCode::NOT_FOUND);
        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn unknown_route_is_404_and_assets_are_immutable() {
        let (state, root) = state();
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("assets/app-123.js"), "export{};").unwrap();
        let router = app(state);
        let unknown = router
            .clone()
            .oneshot(Request::get("/unknown").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(unknown.status(), StatusCode::NOT_FOUND);
        let asset = router
            .oneshot(
                Request::get("/assets/app-123.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            asset.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=31536000, immutable"
        );
        assert!(asset.headers().contains_key(header::ETAG));
        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn invalid_identity_is_rejected_with_bearer_challenge() {
        let (mut state, root) = state();
        state.auth = AuthMode::Entra(EntraVerifier {
            tenant_id: TENANT_ID.into(),
            client_id: CLIENT_ID.into(),
            discovery_url: "https://invalid.example/.well-known/openid-configuration".into(),
            cache: Arc::new(RwLock::new(None)),
            http: Client::new(),
        });
        let response = app(state)
            .oneshot(
                Request::get("/api/rooms")
                    .header(header::AUTHORIZATION, "Bearer not-a-jwt")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(
            response.headers().get(header::WWW_AUTHENTICATE).unwrap(),
            "Bearer"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
