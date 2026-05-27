import React from "react";
import { brand } from "../data/brand";

export const Background: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: `linear-gradient(135deg, ${brand.navy} 0%, #0d1b2e 60%, #0a1628 100%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: brand.fontSans,
      overflow: "hidden",
      position: "relative",
    }}
  >
    {/* subtle grid overlay */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle, rgba(0,207,255,0.04) 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        pointerEvents: "none",
      }}
    />
    {children}
  </div>
);
