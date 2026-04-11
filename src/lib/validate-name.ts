/**
 * Name quality validation
 * =======================
 * Rejects obviously fake or placeholder names before they enter the DB.
 * Used at registration and profile update.
 *
 * Rules:
 *  - Must be at least 2 characters (after trimming)
 *  - Must not be on the blocklist of known placeholder values
 *  - Must not be purely numeric
 *  - Must not be all the same repeated character (e.g. "aaaa")
 *  - Must contain at least one letter
 */

const BLOCKLIST = new Set([
  "test", "testing", "tester",
  "user", "user1", "user2",
  "admin", "administrator",
  "demo", "sample", "example",
  "foo", "bar", "baz",
  "asdf", "qwerty", "zxcv",
  "abc", "xyz",
  "name", "firstname", "lastname", "fullname",
  "anonymous", "anon",
  "null", "undefined", "none", "na", "n/a",
  "placeholder",
  "fake", "fakename",
  "random",
]);

export interface NameValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates a name string for plausibility.
 * Returns { valid: true } if acceptable, or { valid: false, reason } if not.
 * Pass `fieldLabel` to customise the error message (e.g. "Company name").
 */
export function validateName(
  value: string | null | undefined,
  fieldLabel = "Name"
): NameValidationResult {
  if (!value || value.trim().length === 0) {
    // Empty is allowed — name is optional in most contexts
    return { valid: true };
  }

  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return { valid: false, reason: `${fieldLabel} must be at least 2 characters.` };
  }

  // Must contain at least one letter
  if (!/[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(trimmed)) {
    return { valid: false, reason: `${fieldLabel} must contain at least one letter.` };
  }

  // Purely numeric
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, reason: `${fieldLabel} cannot be a number.` };
  }

  // All same character repeated (e.g. "aaaa", "1111")
  if (/^(.)\1+$/.test(trimmed)) {
    return { valid: false, reason: `${fieldLabel} is not valid.` };
  }

  // Blocklist check — normalise: lowercase, strip spaces and punctuation
  const normalised = trimmed.toLowerCase().replace(/[\s\-_.]/g, "");
  if (BLOCKLIST.has(normalised)) {
    return { valid: false, reason: `Please enter your real ${fieldLabel.toLowerCase()}.` };
  }

  // Blocklist with numbers stripped (catches "test123", "user1", etc.)
  const withoutNumbers = normalised.replace(/\d+/g, "");
  if (withoutNumbers.length >= 2 && BLOCKLIST.has(withoutNumbers)) {
    return { valid: false, reason: `Please enter your real ${fieldLabel.toLowerCase()}.` };
  }

  return { valid: true };
}
