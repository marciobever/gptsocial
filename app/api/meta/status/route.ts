import { NextResponse } from "next/server";
import { getMetaAssets } from "@/lib/meta";
import { getMetaSession } from "@/lib/meta-session";

export async function GET() {
  try {
    const session = await getMetaSession();
    if (!session) {
      return NextResponse.json(
        { connected: false, needsAuth: true, error: "Meta não conectada." },
        { status: 401 },
      );
    }
    const assets = await getMetaAssets(session.token);
    return NextResponse.json({ connected: true, source: session.source, ...assets });
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
