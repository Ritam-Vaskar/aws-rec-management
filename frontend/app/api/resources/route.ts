import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend-url";

export async function GET() {
  try {
    const response = await fetch(`${getBackendUrl()}/resources`, {
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
