import { NextRequest, NextResponse } from "next/server";

import { codeChallenge, cookieOptions, encryptJson, oidcStateCookieName, randomToken } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const authorizationUrl = process.env.OIDC_AUTHORIZATION_URL;
  const clientId = process.env.OIDC_CLIENT_ID;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const scope = process.env.OIDC_SCOPES ?? "openid profile email";

  if (!authorizationUrl || !clientId || !redirectUri) {
    return NextResponse.json({ detail: "OIDC frontend settings are not configured." }, { status: 500 });
  }

  const state = randomToken();
  const verifier = randomToken();
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/";
  const url = new URL(authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(url);
  response.cookies.set(oidcStateCookieName, encryptJson({ state, verifier, returnTo, createdAt: Date.now() }), cookieOptions(600));
  return response;
}
