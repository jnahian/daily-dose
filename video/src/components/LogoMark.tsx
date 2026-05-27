import React from "react";
import { Img, staticFile } from "remotion";
import { brand } from "../data/brand";

interface LogoMarkProps {
  size?: number;
  showTagline?: boolean;
}

export const LogoMark: React.FC<LogoMarkProps> = ({ size = 80, showTagline = false }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
    <Img
      src={staticFile("logo.png")}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        boxShadow: `0 0 ${size * 0.4}px ${brand.cyan}44`,
      }}
    />
    <div
      style={{
        fontSize: size * 0.38,
        fontWeight: 700,
        color: brand.textStrong,
        letterSpacing: "-0.02em",
        fontFamily: brand.fontSans,
      }}
    >
      Daily Dose
    </div>
    {showTagline && (
      <div
        style={{
          fontSize: size * 0.18,
          color: brand.textMuted,
          fontFamily: brand.fontSans,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Standups without the meeting
      </div>
    )}
  </div>
);
