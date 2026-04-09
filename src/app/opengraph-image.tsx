import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cascrow — AI-Powered Escrow on XRPL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const font = await fetch(
    "https://fonts.gstatic.com/s/librefranklin/v14/jizOREVItHgc8qDIbSTKq371hRpX9sn9.woff2"
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          background: "#171311",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        {/* Logo bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
          <div style={{ width: 240, height: 14, borderRadius: 6, background: "#C4704B", opacity: 1 }} />
          <div style={{ width: 240, height: 14, borderRadius: 6, background: "#C4704B", opacity: 0.55, marginLeft: 40 }} />
          <div style={{ width: 240, height: 14, borderRadius: 6, background: "#C4704B", opacity: 0.22, marginLeft: 80 }} />
        </div>

        {/* cascrow */}
        <div
          style={{
            fontFamily: "Libre Franklin",
            fontWeight: 300,
            fontSize: 96,
            color: "#EDE6DD",
            letterSpacing: 24,
            marginBottom: 16,
          }}
        >
          cascrow
        </div>

        {/* slogan */}
        <div
          style={{
            fontFamily: "Libre Franklin",
            fontWeight: 300,
            fontSize: 28,
            color: "#A89B8C",
            letterSpacing: 10,
          }}
        >
          proof unlocks funds
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Libre Franklin",
          data: font,
          style: "normal",
          weight: 300,
        },
      ],
    }
  );
}
