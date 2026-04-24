import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;
const SALT = "cascrow-confidential-v1";

function deriveKey(passphrase: string): Buffer {
  return crypto.scryptSync(passphrase, SALT, KEY_LEN);
}

/**
 * Encrypts a goal object (title + description) with AES-256-GCM.
 * Returns a string in the format: enc:<iv_hex>:<ciphertext_hex>:<tag_hex>
 */
export function encryptGoal(
  title: string,
  description: string | null | undefined,
  passphrase: string
): string {
  const plaintext = JSON.stringify({ title, description: description ?? "" });
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

/**
 * Decrypts an encrypted goal string back to { title, description }.
 * Throws if the passphrase is wrong or the data is tampered.
 */
export function decryptGoal(
  ciphertext: string,
  passphrase: string
): { title: string; description: string } {
  if (!ciphertext.startsWith("enc:")) throw new Error("Invalid ciphertext format");
  const parts = ciphertext.slice(4).split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, ctHex, tagHex] = parts;

  const key = deriveKey(passphrase);
  const iv = Buffer.from(ivHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = decipher.update(ct).toString("utf8") + decipher.final("utf8");

  return JSON.parse(decrypted) as { title: string; description: string };
}

/**
 * Returns the SHA-256 hex digest of the goal commitment:
 * sha256(title + "\n" + description + "\n" + salt)
 * This hash is stored on-chain as the tamper-evident commitment.
 */
export function hashGoal(
  title: string,
  description: string | null | undefined,
  salt: string
): string {
  const payload = `${title}\n${description ?? ""}\n${salt}`;
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}
