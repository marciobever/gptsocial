const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET não configurado.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptMetaToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(token));
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptMetaToken(value: string) {
  const [ivPart, encryptedPart] = value.split(".");
  if (!ivPart || !encryptedPart) throw new Error("Sessão Meta inválida.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    await encryptionKey(),
    fromBase64Url(encryptedPart),
  );
  return decoder.decode(decrypted);
}
