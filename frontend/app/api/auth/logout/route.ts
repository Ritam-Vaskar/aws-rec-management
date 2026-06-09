import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.set({
    name: "aws_dash_session",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 0,
  });
  return response;
}