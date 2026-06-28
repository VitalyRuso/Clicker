use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    service_name: String,
}

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
    service: String,
    version: String,
}

#[derive(Debug, Deserialize)]
struct PlannerRequest {
    instruction: String,
    elements: Vec<PlannerElement>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct PlannerElement {
    element_id: String,
    tag_name: String,
    text: String,
    aria_label: String,
    placeholder: String,
    role: String,
}

#[derive(Serialize)]
struct PlannerResponse {
    ok: bool,
    action_id: String,
    action_kind: String,
    element_id: Option<String>,
    confidence: u8,
    reason: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = Arc::new(AppState {
        service_name: "browser-clicker-agent-api".to_string(),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/plan", post(plan_action))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    tracing::info!(%addr, "starting agent api");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind TCP listener");

    axum::serve(listener, app)
        .await
        .expect("server failed");
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        service: state.service_name.clone(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn plan_action(Json(request): Json<PlannerRequest>) -> Result<Json<PlannerResponse>, StatusCode> {
    if request.instruction.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Placeholder planner for the friend/agent branch.
    // The extension currently uses a local TS planner. This endpoint is the future contract.
    let first_candidate = request.elements.first();

    Ok(Json(PlannerResponse {
        ok: first_candidate.is_some(),
        action_id: Uuid::new_v4().to_string(),
        action_kind: "click".to_string(),
        element_id: first_candidate.map(|element| element.element_id.clone()),
        confidence: if first_candidate.is_some() { 30 } else { 0 },
        reason: "Initial backend contract stub. Replace with a real planner in feature/agent-planner-api.".to_string(),
    }))
}
