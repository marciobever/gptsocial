import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMetaAssets } from "@/lib/meta";
import { decryptMetaToken } from "@/lib/meta-auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const encryptedToken = cookieStore.get("meta_token")?.value;
    if (!encryptedToken) {
      return NextResponse.json(
        { connected: false, needsAuth: true, error: "Meta não conectada." },
        { status: 401 },
      );
    }
    const token = await decryptMetaToken(encryptedToken);
    const assets = await getMetaAssets(token);
    return NextResponse.json({ connected: true, ...assets });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        needsAuth: true,
        error: error instanceof Error ? error.message : "Falha ao conectar com a Meta.",
      },
      { status: 401 },
    );
  }
}
