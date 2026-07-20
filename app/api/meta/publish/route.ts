import { NextResponse } from "next/server";
import { createPausedCampaign } from "@/lib/meta";
import { getMetaSession } from "@/lib/meta-session";

export async function POST(request: Request) {
  try {
    const session = await getMetaSession();
    if (!session) {
      return NextResponse.json({ error: "Conecte sua conta Meta antes de publicar." }, { status: 401 });
    }
    const body = await request.json();
    const required = ["adAccountId", "pageId", "name", "link", "headline", "primaryText", "imageUrl"];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return NextResponse.json({ error: `Campos obrigatórios: ${missing.join(", ")}` }, { status: 400 });
    }
    const result = await createPausedCampaign(session.token, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a campanha." },
      { status: 400 },
    );
  }
}
