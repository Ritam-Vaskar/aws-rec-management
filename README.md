# AWS Resource Governance Dashboard Prototype

This workspace contains a basic end-to-end prototype for the dashboard described in the plan:

- FastAPI backend with a mock AWS-like inventory source
- Next.js frontend for search, filtering, stats, and tag editing
- Docker Compose wiring for local development

## Run locally

1. Copy `.env.example` to `.env`.
2. Start the stack with Docker Compose.

```bash
docker compose up --build
```

3. Open `http://localhost:3000`.

## Notes

The backend currently uses seeded in-memory data so the UI is usable without AWS credentials. The API shape matches the real implementation path, so replacing the mock inventory with boto3-based collectors is a narrow next step.
