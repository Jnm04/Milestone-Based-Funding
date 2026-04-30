"use client";

import { useState } from "react";

interface Props {
  url: string;
}

export default function QRCodeSection({ url }: Props) {
  const [show, setShow] = useState(false);
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=231E1A&color=EDE6DD&margin=2`;

  return (
    <>
      <button
        onClick={() => setShow((s) => !s)}
        className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B", border: "1px solid rgba(196,112,75,0.3)" }}
      >
        {show ? "Hide QR" : "QR Code"}
      </button>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShow(false)}>
          <div className="rounded-2xl p-6 flex flex-col items-center gap-4" style={{ background: "#231E1A", border: "1px solid rgba(196,112,75,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold" style={{ color: "#EDE6DD" }}>Scan to verify</p>
            <img src={qrApiUrl} alt="QR Code" width={200} height={200} className="rounded-lg" />
            <p className="text-xs text-center max-w-48 break-all" style={{ color: "#A89B8C" }}>{url}</p>
            <button onClick={() => setShow(false)} className="text-xs" style={{ color: "#A89B8C" }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
