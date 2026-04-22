import crypto from "crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.ATTESTATION_KEY_SECRET;
  if (!hex) throw new Error("ATTESTATION_KEY_SECRET is not set");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("ATTESTATION_KEY_SECRET must be 32 bytes (64 hex chars)");
  return buf;
}

export function encryptApiKey(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptApiKey(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted API key format");
  const [ivHex, ctHex, tagHex] = parts;
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
