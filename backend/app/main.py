from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

app = FastAPI(
    title="Agri-Pulse API", version="1.0.0",
    description="Endpoint-first backend. Weather and evaluation currently return explicitly marked mock data.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"], expose_headers=["X-AgriPulse-Mode"],
)
app.include_router(router)
