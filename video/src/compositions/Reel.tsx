import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { MainVideo } from "./MainVideo";
import { brand } from "../data/brand";

// 1080×1920 vertical reel (9:16) for Instagram/TikTok/YouTube Shorts
// The 16:9 main content scales to fit the reel width and is centered vertically.
// Top and bottom bands are filled with branded gradient + logo strip.

const CONTENT_W = 1080;
const CONTENT_H = Math.round(1080 * (1080 / 1920)); // 607px — scaled 16:9 at reel width
const REEL_H = 1920;
const SCALE = CONTENT_W / 1920; // 0.5625

const TOP_H = Math.round((REEL_H - CONTENT_H) / 2);   // ~656px
const BOTTOM_H = REEL_H - CONTENT_H - TOP_H;           // remainder

export const Reel: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(180deg, ${brand.navy} 0%, #0d1b2e 60%, #0a1628 100%)`,
      fontFamily: brand.fontSans,
    }}
  >
    {/* Top band — logo + tagline */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: CONTENT_W,
        height: TOP_H,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Img
          src={staticFile("logo.png")}
          style={{ width: 64, height: 64, borderRadius: 14 }}
        />
        <span
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: brand.textStrong,
            letterSpacing: "-0.02em",
          }}
        >
          Daily Dose
        </span>
      </div>
      <div
        style={{
          fontSize: 22,
          color: brand.textMuted,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Standups without the meeting
      </div>
    </div>

    {/* Main content — scaled 16:9 video centered */}
    <div
      style={{
        position: "absolute",
        top: TOP_H,
        left: 0,
        width: CONTENT_W,
        height: CONTENT_H,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${SCALE})`,
          transformOrigin: "top left",
        }}
      >
        <MainVideo />
      </div>
    </div>

    {/* Bottom band — URL */}
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: CONTENT_W,
        height: BOTTOM_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 28,
          color: brand.accent,
          letterSpacing: "0.02em",
          fontWeight: 500,
        }}
      >
        dd.jnahian.me
      </div>
    </div>
  </AbsoluteFill>
);
