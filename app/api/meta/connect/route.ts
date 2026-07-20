import { NextRequest, NextResponse } from "next/server";

const SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
];

export async function GET(request: NextRequest) {
  if (request.nextUrl.hostname === "127.0.0.1") {
    const localhostUrl = request.nextUrl.clone();
    localhostUrl.hostname = "localhost";
    return NextResponse.redirect(localhostUrl);
  }

  const appId = process.env.META_APP_ID;
  if (!appId) return NextResponse.json({ error: "META_APP_ID não configurado." }, { status: 500 });
  const redirectUri = process.env.META_REDIRECT_URI || new URL("/api/meta/callback", request.url).toString();
  const state = crypto.randomUUID();
  const auth = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  auth.searchParams.set("client_id", appId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("state", state);
  auth.searchParams.set("scope", SCOPES.join(","));
  auth.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(auth);
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 600,
  });
  return response;
}
