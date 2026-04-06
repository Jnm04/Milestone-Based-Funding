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

// OpenAI logo — not in this version of simple-icons, inlined manually
function OpenAIIcon({ size = 20, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
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

const MUTED = "rgba(107,94,82,0.55)";

export type FooterLogoItem = { name: string; renderIcon: (hovered: boolean) => React.ReactNode };

export const FOOTER_LOGOS: FooterLogoItem[] = [
  { name: "XRPL EVM Sidechain", renderIcon: (h) => <SimpleIcon path={siXrp.path}         size={13} color={h ? "#00AAE4" : MUTED} /> },
  { name: "XRP Ledger",         renderIcon: (h) => <SimpleIcon path={siRipple.path}       size={13} color={h ? "#0085C0" : MUTED} /> },
  { name: "MetaMask",           renderIcon: (h) => <span style={{ opacity: h ? 1 : 0.45 }}><MetaMaskIcon size={13} /></span> },
  { name: "Claude",             renderIcon: (h) => <SimpleIcon path={siAnthropic.path}    size={13} color={h ? "#C1654A" : MUTED} /> },
  { name: "Gemini",             renderIcon: (h) => <SimpleIcon path={siGooglegemini.path} size={13} color={h ? "#4285F4" : MUTED} /> },
  { name: "OpenAI",             renderIcon: (h) => <OpenAIIcon size={13} color={h ? "#10A37F" : MUTED} /> },
  { name: "Mistral",            renderIcon: (h) => <SimpleIcon path={siMistralai.path}    size={13} color={h ? "#FF7000" : MUTED} /> },
  { name: "Qwen",               renderIcon: (h) => <span style={{ fontSize: 10, fontWeight: 700, color: h ? "#7C3AED" : MUTED, lineHeight: 1, fontFamily: "monospace" }}>Q</span> },
];
