import { NextRequest, NextResponse } from "next/server";
import { createXummSignRequest } from "@/services/xrpl/xumm.service";

/**
 * POST /api/auth/xumm-signin
 * Creates a Xumm SignIn payload for wallet-based login.
 * Returns the Xumm redirect URL and polling UUID.
 */
export async function POST(request: NextRequest) {
  try {
    const { role } = await request.json();

    if (!role || !["INVESTOR", "STARTUP"].includes(role)) {
      return NextResponse.json({ error: "role must be INVESTOR or STARTUP" }, { status: 400 });
    }

    const returnUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard/${
      role === "INVESTOR" ? "investor" : "startup"
    }`;

    const payload = await createXummSignRequest(
      { TransactionType: "SignIn" },
      { returnUrl, expiresIn: 300 }
    );

    return NextResponse.json({
      uuid: payload.uuid,
      next: payload.next.always,
      qrPng: payload.refs.qr_png,
    });
  } catch (err) {
    console.error("Xumm signin error:", err);
    return NextResponse.json(
      { error: "Failed to create Xumm sign request. Is XUMM_API_KEY configured?" },
      { status: 500 }
    );
  }
}
