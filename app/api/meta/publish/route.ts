import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPausedCampaign } from "@/lib/meta";
import { decryptMetaToken } from "@/lib/meta-auth";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const encryptedToken = cookieStore.get("meta_token")?.value;
    if (!encryptedToken) {
      return NextResponse.json({ error: "Conecte sua conta Meta antes de publicar." }, { status: 401 });
    }
    const token = await decryptMetaToken(encryptedToken);
    const body = await request.json();
    const required = ["adAccountId", "pageId", "name", "link", "headline", "primaryText", "imageUrl"];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return NextResponse.json({ error: `Campos obrigatórios: ${missing.join(", ")}` }, { status: 400 });
    }
    const result = await createPausedCampaign(token, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a campanha." },
      { status: 400 },
    );
  }
}
