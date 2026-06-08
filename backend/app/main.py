from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import resources, tags


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


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}