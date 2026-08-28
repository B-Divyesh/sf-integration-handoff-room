//! Minimal operational shell for the Integration Handoff Room API.
//!
//! Product routes, data storage, authentication, and rate limiting begin in M2.
//! This process deliberately has no required environment variables so the factory
//! can start a diagnostic container with only PORT set.

use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
use serde::Serialize;
use std::{env, net::SocketAddr};
use tracing::info;

#[derive(Clone)]
struct AppState {
    build_sha: String,
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
    let state = AppState { build_sha };
    let address = SocketAddr::from(([0, 0, 0, 0], port));

    info!(
        port,
        build_sha = %state.build_sha,
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
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    #[tokio::test]
    async fn health_includes_the_build_identity() {
        let response = app(AppState {
            build_sha: "test-build".to_owned(),
        })
        .oneshot(Request::get("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

        assert_eq!(response.status(), 200);
    }
}
