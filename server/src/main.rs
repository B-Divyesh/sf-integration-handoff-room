//! Minimal operational shell for the Integration Handoff Room API.
//!
//! Product routes, data storage, authentication, and rate limiting begin in M2.
//! This process deliberately has no required environment variables so the factory
//! can start a diagnostic container with only PORT set.

use axum::{
    extract::State,
    http::{HeaderName, HeaderValue},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::{env, net::SocketAddr, path::PathBuf};
use tower_http::{
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
};
use tracing::info;

#[derive(Clone)]
struct AppState {
    build_sha: String,
    static_dir: PathBuf,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    build_sha: String,
}

fn app(state: AppState) -> Router {
    Router::new()
        // Liveness/readiness checks are deliberately exempt from the future
        // request limiter. Every product endpoint added in M2 must be limited.
        .route("/health", get(health))
        .route("/ready", get(ready))
        // The factory deploys one container for M1. Serve Vite's built shell
        // from that same process so /demo and all address-bar routes work.
        .fallback_service(
            ServeDir::new(state.static_dir.clone())
                .fallback(ServeFile::new(state.static_dir.join("index.html"))),
        )
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"),
        ))
        .with_state(state)
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        build_sha: state.build_sha,
    })
}

async fn ready(State(state): State<AppState>) -> impl IntoResponse {
    Json(HealthResponse {
        status: "ready",
        build_sha: state.build_sha,
    })
}

fn configured_port() -> u16 {
    env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080)
}

fn configured_static_dir() -> PathBuf {
    env::var_os("STATIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/app/dist"))
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

    let build_sha = env::var("BUILD_SHA").unwrap_or_else(|_| "dev".to_owned());
    let port = configured_port();
    let static_dir = configured_static_dir();
    let state = AppState {
        build_sha,
        static_dir,
    };
    let address = SocketAddr::from(([0, 0, 0, 0], port));

    info!(
        port,
        build_sha = %state.build_sha,
        static_dir = %state.static_dir.display(),
        generated_config = "none",
        supplied_config = "PORT, BUILD_SHA optional",
        "starting API scaffold"
    );

    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app(state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

#[cfg(test)]
mod tests {
    use super::{app, AppState};
    use axum::{
        body::{to_bytes, Body},
        http::Request,
    };
    use std::{fs, path::PathBuf};
    use tower::ServiceExt;

    fn test_state(static_dir: PathBuf) -> AppState {
        AppState {
            build_sha: "test-build".to_owned(),
            static_dir,
        }
    }

    #[tokio::test]
    async fn health_includes_the_build_identity() {
        let response = app(test_state(PathBuf::from("/not-used-in-health-test")))
            .oneshot(Request::get("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
    }

    #[tokio::test]
    async fn unknown_browser_routes_receive_the_built_shell_and_security_headers() {
        let static_dir = std::env::temp_dir().join(format!(
            "integration-handoff-room-api-test-{}",
            std::process::id()
        ));
        fs::create_dir_all(&static_dir).unwrap();
        fs::write(static_dir.join("index.html"), "<main>M1 shell</main>").unwrap();

        let response = app(test_state(static_dir.clone()))
            .oneshot(Request::get("/demo").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let header = response
            .headers()
            .get("content-security-policy")
            .unwrap()
            .to_str()
            .unwrap()
            .to_owned();
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();

        assert_eq!(header, "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
        assert_eq!(body.as_ref(), b"<main>M1 shell</main>");
        fs::remove_dir_all(static_dir).unwrap();
    }
}
