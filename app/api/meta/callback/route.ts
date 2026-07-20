import { NextRequest, NextResponse } from "next/server";
import { encryptMetaToken } from "@/lib/meta-auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("meta_oauth_state")?.value;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI || new URL("/api/meta/callback", request.url).toString();
  const home = new URL("/", request.url);

  if (!code || !state || !expectedState || state !== expectedState) {
    home.searchParams.set("meta_error", "Autorização inválida ou expirada.");
    return NextResponse.redirect(home);
  }
  if (!appId || !appSecret) {
    home.searchParams.set("meta_error", "Credenciais Meta ausentes no servidor.");
    return NextResponse.redirect(home);
  }

  try {
    const shortUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
    shortUrl.searchParams.set("client_id", appId);
    shortUrl.searchParams.set("client_secret", appSecret);
    shortUrl.searchParams.set("redirect_uri", redirectUri);
    shortUrl.searchParams.set("code", code);
    const shortData = await (await fetch(shortUrl)).json();
    if (shortData.error) throw new Error(shortData.error.message);

    const longUrl = new URL("https://graph.facebook.com/v25.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", shortData.access_token);
    const longData = await (await fetch(longUrl)).json();
    if (longData.error) throw new Error(longData.error.message);
    const token = longData.access_token || shortData.access_token;

    const response = NextResponse.redirect(home);
    response.cookies.set("meta_token", await encryptMetaToken(token), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 24 * 60 * 60,
    });
    response.cookies.delete("meta_oauth_state");
    return response;
  } catch (error) {
    home.searchParams.set("meta_error", error instanceof Error ? error.message : "Falha na conexão Meta.");
    return NextResponse.redirect(home);
  }
}
