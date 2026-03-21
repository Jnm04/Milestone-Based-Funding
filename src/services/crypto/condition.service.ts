import crypto from "crypto";
import { CryptoCondition } from "@/types";

/**
 * Generates a SHA-256 preimage crypto-condition.
 *
 * XRPL uses the cc (crypto-conditions) spec (RFC draft).
 * For a preimage condition:
 *   - Fulfillment = 0x00 (type) + varint(len) + preimage
 *   - Condition   = 0x01 (type) + varint(len) + sha256(fulfillment) + varint(maxFulfillmentLength)
 *
 * We use the simplified hex encoding that xrpl.js / rippled accepts.
 */

function encodeVarint(n: number): Buffer {
  if (n < 128) return Buffer.from([n]);
  if (n < 16384) return Buffer.from([0x80 | (n >> 7), n & 0x7f]);
  throw new Error("varint too large");
}

/**
 * Encodes a preimage fulfillment per the crypto-conditions spec (type 0x00).
 * Returns the hex string rippled expects in EscrowFinish.Fulfillment.
 */
function encodeFulfillment(preimage: Buffer): string {
  const typeTag = Buffer.from([0xa0]); // PREIMAGE-SHA-256 constructed
  const innerContent = Buffer.concat([
    Buffer.from([0x80]), // context tag 0
    encodeVarint(preimage.length),
    preimage,
  ]);
  const result = Buffer.concat([
    typeTag,
    encodeVarint(innerContent.length),
    innerContent,
  ]);
  return result.toString("hex").toUpperCase();
}

/**
 * Encodes a preimage condition per the crypto-conditions spec (type 0x01).
 * Returns the hex string rippled expects in EscrowCreate.Condition.
 */
function encodeCondition(preimage: Buffer): string {
  const fingerprint = crypto.createHash("sha256").update(preimage).digest();
  const maxFulfillmentLength = preimage.length; // cost = preimage length per crypto-conditions spec

  const innerContent = Buffer.concat([
    Buffer.from([0x80]), // fingerprint tag
    encodeVarint(fingerprint.length),
    fingerprint,
    Buffer.from([0x81]), // maxFulfillmentLength tag
    encodeVarint(1),
    Buffer.from([maxFulfillmentLength]),
  ]);

  const typeTag = Buffer.from([0xa0]); // PREIMAGE-SHA-256 condition
  const result = Buffer.concat([
    typeTag,
    encodeVarint(innerContent.length),
    innerContent,
  ]);
  return result.toString("hex").toUpperCase();
}

/**
 * Generate a new crypto-condition pair (condition + fulfillment).
 * Store the fulfillment server-side only — never expose it to clients.
 */
export function generateCryptoCondition(): CryptoCondition {
  const preimage = crypto.randomBytes(32);
  return {
    condition: encodeCondition(preimage),
    fulfillment: encodeFulfillment(preimage),
  };
}
