# AWS Resource Governance Dashboard Prototype

This workspace contains the dashboard prototype described in the plan:

- FastAPI backend backed by live boto3 calls
- Next.js frontend for search, filtering, stats, and tag editing
- Docker Compose wiring for local development

## Run locally

1. Copy `.env.example` to `.env` and fill in your AWS credentials or role ARN.
2. Start the stack with Docker Compose.

```bash
docker compose up --build
```

3. Open `http://localhost:3000`.

## Notes

The backend now reads directly from AWS using boto3. If you prefer cross-account access, set `AWS_ASSUME_ROLE_ARN` alongside your base credentials.
