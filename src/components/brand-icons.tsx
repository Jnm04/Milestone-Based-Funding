import type React from "react";
import { siXrp, siAnthropic, siRipple, siGooglegemini, siMistralai } from "simple-icons";

interface BrandIconProps {
  path: string;
  size?: number;
  color?: string;
}

function SimpleIcon({ path, size = 20, color = "#ffffff" }: BrandIconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} />
    </svg>
  );
}

// MetaMask fox — inline SVG (not in simple-icons)
function MetaMaskIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 35 33" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <g fillRule="nonzero" fill="none">
        <polygon fill="#E17726" points="32.958 1 19.06 10.892 21.616 5.029"/>
        <polygon fill="#E27625" points="2.055 1 15.84 10.984 13.396 5.029"/>
        <polygon fill="#E27625" points="28.123 23.36 24.348 29.07 32.168 31.175 34.36 23.48"/>
        <polygon fill="#E27625" points="0.652 23.48 2.832 31.175 10.641 29.07 6.878 23.36"/>
        <polygon fill="#E27625" points="10.219 14.484 8.089 17.634 15.839 17.977 15.576 9.686"/>
        <polygon fill="#E27625" points="24.793 14.484 19.308 9.594 19.061 17.977 26.8 17.634"/>
        <polygon fill="#E27625" points="10.641 29.07 15.361 26.847 11.294 23.536"/>
        <polygon fill="#E27625" points="19.65 26.847 24.348 29.07 23.717 23.536"/>
        <polygon fill="#D5BFB2" points="24.348 29.07 19.65 26.847 20.033 30.052 19.99 31.071"/>
        <polygon fill="#D5BFB2" points="10.641 29.07 15.021 31.071 14.978 30.052 15.361 26.847"/>
        <polygon fill="#233447" points="15.1 22.114 11.193 21.003 13.862 19.771"/>
        <polygon fill="#233447" points="19.911 22.114 21.149 19.771 23.829 21.003"/>
        <polygon fill="#CC6228" points="10.641 29.07 11.316 23.36 6.878 23.48"/>
        <polygon fill="#CC6228" points="23.695 23.36 24.348 29.07 28.123 23.48"/>
        <polygon fill="#CC6228" points="26.8 17.634 19.061 17.977 19.922 22.114 21.16 19.771 23.84 21.003"/>
        <polygon fill="#CC6228" points="11.193 21.003 13.873 19.771 15.1 22.114 15.839 17.977 8.089 17.634"/>
        <polygon fill="#E27525" points="8.089 17.634 11.294 23.536 11.193 21.003"/>
        <polygon fill="#E27525" points="23.84 21.003 23.717 23.536 26.8 17.634"/>
        <polygon fill="#E27525" points="15.839 17.977 15.1 22.114 16.048 26.847 16.26 20.853"/>
        <polygon fill="#E27525" points="19.061 17.977 18.752 20.841 18.963 26.847 19.922 22.114"/>
        <polygon fill="#F5841F" points="19.922 22.114 18.963 26.847 19.65 26.847 23.717 23.536 23.84 21.003"/>
        <polygon fill="#F5841F" points="11.193 21.003 11.294 23.536 15.361 26.847 16.048 26.847 15.1 22.114"/>
        <polygon fill="#C0AC9D" points="15.021 31.071 15.065 30.052 14.693 29.742 20.318 29.742 19.946 30.052 19.99 31.071 15.021 31.071"/>
        <polygon fill="#161616" points="15.361 26.847 16.048 26.847 15.65 29.742"/>
        <polygon fill="#161616" points="19.65 26.847 20.318 29.742 19.911 26.847"/>
        <polygon fill="#763D16" points="15.942 5.029 19.06 1 17.5 1"/>
      </g>
    </svg>
  );
}

export const TECH_LOGOS = [
  {
    name: "XRPL EVM",
    bgColor: "#000000",
    icon: <SimpleIcon path={siXrp.path} size={18} color="#ffffff" />,
  },
  {
    name: "MetaMask",
    bgColor: "#F6851B",
    icon: <MetaMaskIcon size={20} />,
  },
  {
    name: "Ripple",
    bgColor: "#0085C0",
    icon: <SimpleIcon path={siRipple.path} size={16} color="#ffffff" />,
  },
  {
    name: "Claude AI",
    bgColor: "#191919",
    icon: <SimpleIcon path={siAnthropic.path} size={18} color="#C1654A" />,
  },
  {
    name: "RLUSD",
    bgColor: "#0085C0",
    icon: <SimpleIcon path={siRipple.path} size={16} color="#ffffff" />,
  },
];

const ICON_COLOR = "rgba(107,94,82,0.65)";

export const FOOTER_LOGOS: { name: string; icon: React.ReactNode }[] = [
  { name: "XRPL EVM Sidechain", icon: <SimpleIcon path={siXrp.path}          size={13} color={ICON_COLOR} /> },
  { name: "XRP Ledger",         icon: <SimpleIcon path={siRipple.path}        size={13} color={ICON_COLOR} /> },
  { name: "MetaMask",           icon: <span style={{ opacity: 0.45 }}><MetaMaskIcon size={13} /></span> },
  { name: "Claude",             icon: <SimpleIcon path={siAnthropic.path}     size={13} color={ICON_COLOR} /> },
  { name: "Gemini",             icon: <SimpleIcon path={siGooglegemini.path}  size={13} color={ICON_COLOR} /> },
  { name: "OpenAI",             icon: <span style={{ fontSize: 10, fontWeight: 700, color: ICON_COLOR, lineHeight: 1, fontFamily: "monospace" }}>O</span> },
  { name: "Mistral",            icon: <SimpleIcon path={siMistralai.path}     size={13} color={ICON_COLOR} /> },
  { name: "Qwen",               icon: <span style={{ fontSize: 10, fontWeight: 700, color: ICON_COLOR, lineHeight: 1, fontFamily: "monospace" }}>Q</span> },
];
