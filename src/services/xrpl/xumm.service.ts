import { XummSdk } from "xumm-sdk";
import type { XummPostPayloadBodyJson } from "xumm-sdk/dist/src/types/xumm-api";

let xumm: XummSdk | null = null;

function getXumm(): XummSdk {
  if (!xumm) {
    const apiKey = process.env.XUMM_API_KEY;
    const apiSecret = process.env.XUMM_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("XUMM_API_KEY and XUMM_API_SECRET must be set");
    }
    xumm = new XummSdk(apiKey, apiSecret);
  }
  return xumm;
}

export interface XummPayload {
  uuid: string;
  next: { always: string };   // redirect URL
  refs: { qr_png: string };   // QR code image
  pushed: boolean;
}

/**
 * Creates a Xumm sign request for any XRPL transaction.
 * Returns a payload the frontend can redirect to or display as QR.
 */
export async function createXummSignRequest(
  txJson: Record<string, unknown> & { TransactionType: string },
  options?: {
    returnUrl?: string;
    expiresIn?: number; // seconds
    customMeta?: Record<string, unknown>; // arbitrary data sent back in webhook
  }
): Promise<XummPayload> {
  const sdk = getXumm();

  const body: XummPostPayloadBodyJson = {
    txjson: txJson as XummPostPayloadBodyJson["txjson"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    custom_meta: options?.customMeta ? { blob: options.customMeta } as any : undefined,
    options: {
      submit: false,          // user signs, we submit — keeps control
      expire: options?.expiresIn ?? 300, // 5 min default
      return_url: options?.returnUrl
        ? { app: options.returnUrl, web: options.returnUrl }
        : undefined,
    },
  };

  // Pass returnErrors=true so the SDK throws instead of silently returning null
  const payload = await sdk.payload.create(body, true);

  return {
    uuid: payload.uuid,
    next: { always: payload.next.always },
    refs: { qr_png: payload.refs.qr_png },
    pushed: payload.pushed,
  };
}

/**
 * Polls a Xumm payload for the user's signature.
 * Returns the signed tx blob if signed, null if pending/rejected.
 */
export async function getXummPayloadResult(uuid: string): Promise<{
  resolved: boolean;  // true = user acted (signed or rejected); false = still pending
  signed: boolean;
  txBlob?: string;
  txHash?: string;
  signerAddress?: string;
} | null> {
  const sdk = getXumm();
  const result = await sdk.payload.get(uuid);
  if (!result) return null;

  const { meta, response } = result;

  if (!meta.resolved) {
    // Still waiting for the user to act in Xaman
    return { resolved: false, signed: false };
  }

  if (!meta.signed) {
    // User rejected / cancelled
    return { resolved: true, signed: false };
  }

  return {
    resolved: true,
    signed: true,
    txBlob: response.hex ?? undefined,
    txHash: response.txid ?? undefined,
    signerAddress: response.account ?? undefined,
  };
}

/**
 * Cancels a pending Xumm payload.
 */
export async function cancelXummPayload(uuid: string): Promise<void> {
  const sdk = getXumm();
  await sdk.payload.cancel(uuid);
}
