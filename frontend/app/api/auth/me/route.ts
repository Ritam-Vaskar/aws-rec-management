import { NextResponse } from "next/server";

import { getDashboardSession } from "@/lib/server-auth";

export async function GET() {
  const session = getDashboardSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: session.user, expiresAt: session.expiresAt });
}
