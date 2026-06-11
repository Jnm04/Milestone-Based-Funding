import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cascrow — Agentic Escrow & Verification";
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
        {/* Logo icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="10 10 80 80"
          width={120}
          height={120}
          style={{ marginBottom: 40 }}
        >
          <path
            fill="#C4704B"
            d="M 30.7,67.3 A 33,33 0 1,1 85.9,35.5 L 71.4,39.3 A 18,18 0 1,0 41.3,56.7 Z"
          />
          <path
            fill="#C4704B"
            d="M 69.3,32.7 A 33,33 0 1,1 14.1,64.5 L 28.6,60.7 A 18,18 0 1,0 58.7,43.3 Z"
          />
        </svg>

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
