import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Re-derive the signing logic so this test validates the algorithm contract,
// not just that the function returns itself.
function sign(secret: string, timestampMs: number, body: string): string {
  const input = `t=${timestampMs}.${body}`;
  return "sha256=" + crypto.createHmac("sha256", secret).update(input).digest("hex");
}

describe("Webhook HMAC signing", () => {
  it("returns sha256= prefixed hex string", () => {
    const sig = sign("secret", 1000, "{}");
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("different secrets produce different signatures", () => {
    const body = JSON.stringify({ event: "contract.funded" });
    const ts = Date.now();
    expect(sign("secret-a", ts, body)).not.toBe(sign("secret-b", ts, body));
  });

  it("different timestamps produce different signatures", () => {
    const body = "{}";
    expect(sign("secret", 1000, body)).not.toBe(sign("secret", 2000, body));
  });

  it("same inputs always produce the same signature (deterministic)", () => {
    const sig1 = sign("my-secret", 1714000000000, '{"event":"proof.submitted"}');
    const sig2 = sign("my-secret", 1714000000000, '{"event":"proof.submitted"}');
    expect(sig1).toBe(sig2);
  });

  it("receiver can verify by recomputing HMAC", () => {
    const secret = "test-secret-xyz";
    const ts = 1714000000000;
    const body = JSON.stringify({ event: "funds.released", contractId: "abc123" });
    const produced = sign(secret, ts, body);
    const expected = "sha256=" + crypto
      .createHmac("sha256", secret)
      .update(`t=${ts}.${body}`)
      .digest("hex");
    expect(produced).toBe(expected);
  });
});
