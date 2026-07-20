import { cookies } from "next/headers";
import { decryptMetaToken } from "@/lib/meta-auth";

export type MetaSession = {
  token: string;
  source: "oauth" | "system";
};

export async function getMetaSession(): Promise<MetaSession | null> {
  const cookieStore = await cookies();
  const encryptedToken = cookieStore.get("meta_token")?.value;

  if (encryptedToken) {
    try {
      return { token: await decryptMetaToken(encryptedToken), source: "oauth" };
    } catch {
      // Uma sessão expirada não impede o fallback seguro do System User.
    }
  }

  const systemToken = process.env.META_SYSTEM_TOKEN;
  return systemToken ? { token: systemToken, source: "system" } : null;
}
