import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend-url";

export async function GET(request: Request) {
  try {
    const response = await fetch(`${getBackendUrl()}/auth/session`, {
      cache: "no-store",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
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