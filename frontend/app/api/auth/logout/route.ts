import { NextResponse } from "next/server";

import { cookieOptions, oidcStateCookieName, sessionCookieName } from "@/lib/server-auth";

export async function GET() {
  const response = NextResponse.redirect(new URL("/", process.env.APP_BASE_URL ?? "http://localhost:3000"));
  response.cookies.set(sessionCookieName, "", { ...cookieOptions(0), maxAge: 0 });
  response.cookies.set(oidcStateCookieName, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}
