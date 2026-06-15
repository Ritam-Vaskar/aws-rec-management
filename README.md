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

## Production Deployment (AWS ALB + IAM Roles)

For production deployment as an internal tool, it is highly recommended to **not use `.env` access keys**. Instead:

1. **Authentication**: Deploy the application behind an **AWS Application Load Balancer (ALB)**. Configure the ALB to authenticate users via AWS IAM Identity Center (SSO) or Cognito. The ALB will automatically pass user details via the `x-amzn-oidc-data` header, which the backend will read to display the logged-in user.
2. **AWS API Access**: Run the Docker containers on ECS (Fargate) or EC2. Assign an **IAM Task Role** (or Instance Profile) to the containers. Boto3 will automatically fetch temporary credentials securely without any code changes.
