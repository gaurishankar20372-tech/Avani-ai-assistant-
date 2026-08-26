import React, { useState } from "react";
import lotusImg from "../assets/images/lotus_avatar_icon_1787054585543.jpg";

interface LotusThinkingIconProps {
  className?: string;
  size?: number;
}

export const LotusThinkingIcon: React.FC<LotusThinkingIconProps> = ({
  className = "",
  size = 32,
}) => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <div
        className={`relative flex items-center justify-center shrink-0 overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={lotusImg}
          alt="Avani AI Lotus"
          onError={() => setImgError(true)}
          className="w-full h-full object-contain rounded-full drop-shadow-[0_0_8px_rgba(0,168,132,0.5)]"
        />
      </div>
    );
  }

  // High-fidelity fallback SVG matching the exact teal lotus logo geometry
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_8px_rgba(0,168,132,0.6)]"
      >
        <defs>
          <linearGradient id="lotusTealGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E5B0" />
            <stop offset="50%" stopColor="#00A884" />
            <stop offset="100%" stopColor="#008069" />
          </linearGradient>
          <linearGradient id="lotusDarkTeal" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00C49F" />
            <stop offset="100%" stopColor="#006E58" />
          </linearGradient>
        </defs>

        {/* Outer Left Side Petal */}
        <path
          d="M 12 112 C 10 95 35 90 48 93 C 58 95 62 108 55 125 C 45 135 25 130 15 120 Z"
          fill="url(#lotusTealGradient)"
        />
        <circle cx="27" cy="112" r="3.5" fill="#FFFFFF" />
        <path d="M 27 112 L 48 116" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />

        {/* Outer Right Side Petal */}
        <path
          d="M 188 112 C 190 95 165 90 152 93 C 142 95 138 108 145 125 C 155 135 175 130 185 120 Z"
          fill="url(#lotusTealGradient)"
        />

        {/* Upper Left Petal */}
        <path
          d="M 42 62 C 32 82 48 122 72 135 C 78 115 76 80 58 64 C 52 58 45 56 42 62 Z"
          fill="url(#lotusTealGradient)"
        />

        {/* Upper Right Petal */}
        <path
          d="M 158 62 C 168 82 152 122 128 135 C 122 115 124 80 142 64 C 148 58 155 56 158 62 Z"
          fill="url(#lotusTealGradient)"
        />

        {/* Mid Left Petal */}
        <path
          d="M 68 88 C 66 120 90 145 98 148 C 96 130 92 105 78 86 C 74 82 70 82 68 88 Z"
          fill="url(#lotusDarkTeal)"
        />
        <circle cx="68" cy="92" r="6" fill="#FFFFFF" />

        {/* Mid Right Petal */}
        <path
          d="M 132 88 C 134 120 110 145 102 148 C 104 130 108 105 122 86 C 126 82 130 82 132 88 Z"
          fill="url(#lotusDarkTeal)"
        />
        <path
          d="M 104 105 C 125 85 158 92 165 110 C 155 135 120 142 104 125 Z"
          fill="url(#lotusTealGradient)"
        />

        {/* Center Main Tall Petal */}
        <path
          d="M 100 38 C 92 56 78 92 84 136 C 92 142 108 142 116 136 C 122 92 108 56 100 38 Z"
          fill="url(#lotusTealGradient)"
        />

        {/* Center Tech Circuit Stem & Nodes */}
        <circle cx="100" cy="62" r="6.5" fill="#FFFFFF" />
        <path d="M 100 68 L 100 134" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="100" cy="138" r="10" fill="#FFFFFF" />

        {/* Bottom Petals */}
        <path
          d="M 40 148 C 55 178 88 178 98 152 C 82 146 56 142 40 148 Z"
          fill="url(#lotusTealGradient)"
        />
        <path
          d="M 100 190 C 88 175 88 156 100 148 C 112 156 112 175 100 190 Z"
          fill="url(#lotusTealGradient)"
        />
        <path
          d="M 160 148 C 145 178 112 178 102 152 C 118 146 144 142 160 148 Z"
          fill="url(#lotusTealGradient)"
        />
      </svg>
    </div>
  );
};
