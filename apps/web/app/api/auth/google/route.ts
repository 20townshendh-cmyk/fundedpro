import { NextRequest, NextResponse } from "next/server";
import { getWebEnv } from "../../../../lib/env";
import { beginGoogleAuth } from "../../../../lib/google-auth";

export async function GET(request: NextRequest) {
  const authUrl = await beginGoogleAuth();

  if (!authUrl) {
    return NextResponse.redirect(new URL("/signup?error=google-unavailable", getWebEnv().appUrl));
  }

  return NextResponse.redirect(authUrl);
}
