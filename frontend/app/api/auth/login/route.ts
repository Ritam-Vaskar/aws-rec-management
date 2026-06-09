import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/backend-url";

export async function POST(request: Request) {
  try {
    const response = await fetch(`${getBackendUrl()}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: await request.text(),
      cache: "no-store",
    });

    const responseBody = await response.text();
    const proxyResponse = new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });

    if (response.ok) {
      const parsed = JSON.parse(responseBody) as { token?: string };
      if (parsed.token) {
        proxyResponse.cookies.set({
          name: "aws_dash_session",
          value: parsed.token,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: false,
          maxAge: 60 * 60 * 8,
        });
      }
    }

    return proxyResponse;
  } catch {
    return NextResponse.json({ detail: "Unable to reach the backend." }, { status: 502 });
  }
}