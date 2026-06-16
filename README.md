# AWS Resource Governance Dashboard

This workspace contains:

- FastAPI backend backed by live boto3 calls
- Next.js frontend for search, filtering, stats, and tag editing
- OIDC SSO login, backend JWT validation, RBAC, and account-scoped AWS access
- Docker Compose wiring for local development

## Run locally

1. Copy `.env.example` to `.env`.
2. For quick local development without SSO, set `AUTH_ENABLED=false` and `AUTH_BYPASS_LOGIN=true`.
3. For production-like testing, configure the OIDC values, group names, and tenant/account mapping.
4. Start the stack with Docker Compose.

```bash
docker compose up --build
```

5. Open `http://localhost:3000`.

## Production Auth Flow

1. The user signs in through the company OIDC provider.
2. The frontend stores the provider tokens in an encrypted HttpOnly cookie.
3. Next.js API routes forward the access token to FastAPI.
4. FastAPI validates the JWT signature, issuer, audience, expiry, tenant, groups, and roles.
5. RBAC gates reads, refreshes, and tag updates.
6. The backend assumes the configured AWS role only for accounts allowed by the user/tenant policy.
7. AWS APIs are called from backend-controlled IAM roles; users never provide AWS access keys.

## Key Environment Values

- `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`: backend JWT validation.
- `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_CLIENT_ID`, `OIDC_REDIRECT_URI`: frontend OIDC login.
- `AUTH_VIEWER_GROUPS`, `AUTH_TAG_EDITOR_GROUPS`, `AUTH_ADMIN_GROUPS`: IdP groups mapped to app roles.
- `AUTH_TENANT_CLAIM`: token claim used as the tenant ID.
- `AUTH_ACCOUNTS_CLAIM`: token claim containing allowed AWS account IDs, or `*` for all tenant accounts.
- `AUTH_TENANT_ACCOUNTS_JSON`: server-side allow-list of AWS accounts by tenant.
- `AWS_ORG_ACCESS_ROLE_NAME`: read role to assume in member accounts.
- `AWS_TAGGING_ROLE_NAME`: write role to assume for tag updates.

## AWS Credential Guidance

Static `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are only a local fallback. In production, deploy the backend with an IAM runtime role and allow that role to assume `AWS_ORG_ACCESS_ROLE_NAME` / `AWS_TAGGING_ROLE_NAME` in member accounts.
