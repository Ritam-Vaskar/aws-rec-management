import { NextRequest, NextResponse } from "next/server";

import {
  cookieOptions,
  decryptJson,
  encryptJson,
  oidcStateCookieName,
  sessionCookieName,
  sessionFromTokenSet,
} from "@/lib/server-auth";

type OidcState = {
  state: string;
  verifier: string;
  returnTo: string;
  createdAt: number;
};

export async function GET(request: NextRequest) {
  const tokenUrl = process.env.OIDC_TOKEN_URL;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stored = request.cookies.get(oidcStateCookieName)?.value;

  if (!tokenUrl || !clientId || !redirectUri) {
    return NextResponse.json({ detail: "OIDC frontend settings are not configured." }, { status: 500 });
  }
  if (!code || !state || !stored) {
    return NextResponse.json({ detail: "OIDC callback is missing code or state." }, { status: 400 });
  }

  const oidcState = decryptJson<OidcState>(stored);
  if (oidcState.state !== state || Date.now() - oidcState.createdAt > 10 * 60 * 1000) {
    return NextResponse.json({ detail: "OIDC state validation failed." }, { status: 400 });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: oidcState.verifier,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    return NextResponse.json({ detail: "OIDC token exchange failed." }, { status: 502 });
  }

  const session = sessionFromTokenSet((await tokenResponse.json()) as Record<string, unknown>);
  const response = NextResponse.redirect(new URL(oidcState.returnTo || "/", request.url));
  response.cookies.set(sessionCookieName, encryptJson(session), cookieOptions(Math.max(60, session.expiresAt - Math.floor(Date.now() / 1000))));
  response.cookies.set(oidcStateCookieName, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}
