"""
Dashboard Routes

FastAPI routes for the NN Visualization Dashboard.
Provides API endpoint for metrics and serves the dashboard HTML page.
"""

import os
import logging
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, JSONResponse

from ai_engine.simulation.dashboard_metrics import get_dashboard_metrics

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dashboard"])


@router.get("/api/nn-dashboard")
async def get_dashboard_data():
    """
    Return complete dashboard metrics snapshot.

    Returns JSON with:
    - nn_decisions: Chunk frequency, recent decisions, type counts, confidence histogram
    - gate_behavior: Pass rate, decision reasons, component breakdown, reward history
    - training: Loss history, simulation/real rewards, training stats
    - game_state: Current game state info
    """
    try:
        metrics = get_dashboard_metrics()
        snapshot = metrics.get_snapshot()
        return JSONResponse(content=snapshot)
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@router.get("/dashboard", response_class=HTMLResponse)
async def serve_dashboard():
    """
    Serve the dashboard HTML page.

    Returns a single-file HTML dashboard with embedded CSS and JavaScript.
    """
    dashboard_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'static',
        'nn_dashboard.html'
    )

    try:
        with open(dashboard_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        logger.error(f"Dashboard HTML not found at {dashboard_path}")
        return HTMLResponse(
            content="<h1>Dashboard not found</h1><p>The dashboard HTML file is missing.</p>",
            status_code=404
        )
    except Exception as e:
        logger.error(f"Error serving dashboard: {e}")
        return HTMLResponse(
            content=f"<h1>Error</h1><p>{str(e)}</p>",
            status_code=500
        )


@router.post("/api/nn-dashboard/reset")
async def reset_dashboard_metrics():
    """
    Reset all dashboard metrics to initial state.

    Useful for starting fresh observation without restarting server.
    """
    try:
        metrics = get_dashboard_metrics()
        metrics.reset()
        return JSONResponse(content={"status": "success", "message": "Dashboard metrics reset"})
    except Exception as e:
        logger.error(f"Error resetting dashboard metrics: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
