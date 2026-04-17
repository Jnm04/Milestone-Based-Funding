import crypto from "crypto";

const ALGO = "aes-256-gcm";
const ENC_PREFIX = "enc:";

function getKey(): Buffer | null {
  const hex = process.env.FULFILLMENT_ENCRYPTION_KEY;
  if (!hex) return null;
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("FULFILLMENT_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)");
  }
  return buf;
}

/**
 * Encrypt a fulfillment key for DB storage.
 * Returns `enc:<iv_hex>:<ciphertext_hex>:<tag_hex>`.
 * If FULFILLMENT_ENCRYPTION_KEY is not set, returns the plaintext unchanged
 * so existing deployments without the env var keep working.
 */
export function encryptFulfillment(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

/**
 * Decrypt a fulfillment key read from the DB.
 * - Values starting with `enc:` are decrypted with AES-256-GCM.
 * - Plain `0x...` values (legacy) are returned as-is for backwards compatibility.
 */
export function decryptFulfillment(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;

  const key = getKey();
  if (!key) {
    throw new Error(
      "FULFILLMENT_ENCRYPTION_KEY is not set but an encrypted fulfillment was found in the DB. " +
      "Set the env var to the same value used when the fulfillment was encrypted."
    );
  }

  const rest = stored.slice(ENC_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted fulfillment format in DB");
  const [ivHex, ciphertextHex, tagHex] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
