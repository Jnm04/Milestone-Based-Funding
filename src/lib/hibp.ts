import crypto from "crypto";

/**
 * Checks whether a password appears in the HaveIBeenPwned corpus using k-anonymity
 * (only the first 5 chars of the SHA-1 hash are sent — the plaintext never leaves).
 * Fails open: returns false on network errors or timeouts so it never blocks auth.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;

    const text = await res.text();
    return text.split("\n").some((line) => line.split(":")[0].trim() === suffix);
  } catch {
    return false;
  }
}
