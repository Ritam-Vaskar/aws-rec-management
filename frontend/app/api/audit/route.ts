import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend-url";
import { getDashboardSession } from "@/lib/server-auth";

export async function GET(request: Request) {
  const session = getDashboardSession();
  if (!session) return NextResponse.json({ detail: "Authentication required." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const response = await fetch(`${getBackendUrl()}/audit/events${url.search}`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    });

    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json({ detail: "Unable to reach the backend." }, { status: 502 });
  }
}
