import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import resources, tags, operations

# Load environment variables from .env file at project root
env_file = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_file)

app = FastAPI(title="AWS Resource Governance Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resources.router)
app.include_router(tags.router)
app.include_router(operations.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}