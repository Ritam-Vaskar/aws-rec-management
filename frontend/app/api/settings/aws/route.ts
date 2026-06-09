import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend-url";

export async function GET(request: Request) {
  try {
    const response = await fetch(`${getBackendUrl()}/settings/aws`, {
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

export async function POST(request: Request) {
  try {
    const response = await fetch(`${getBackendUrl()}/settings/aws`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: await request.text(),
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