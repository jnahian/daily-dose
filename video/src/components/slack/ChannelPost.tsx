import React from "react";
import { Img, staticFile } from "remotion";
import { brand } from "../../data/brand";

interface ChannelPostProps {
  botName: string;
  avatarBg: string;
  avatarEmoji: string;
  timestamp: string;
  teamName: string;
  date: string;
  submitted: number;
  total: number;
  children: React.ReactNode;
  useLogo?: boolean;
}

export const ChannelPost: React.FC<ChannelPostProps> = ({
  botName,
  avatarBg,
  avatarEmoji,
  timestamp,
  teamName,
  date,
  submitted,
  total,
  children,
  useLogo = false,
}) => (
  <div
    style={{
      display: "flex",
      gap: 12,
      padding: "16px 20px",
      background: brand.bgSurface,
      borderRadius: 8,
      maxWidth: 620,
      width: "100%",
    }}
  >
    {/* Avatar */}
    {useLogo ? (
      <Img
        src={staticFile("logo.png")}
        style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0 }}
      />
    ) : (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 6,
          background: avatarBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {avatarEmoji}
      </div>
    )}

    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: brand.fontSans, fontWeight: 700, fontSize: 15, color: brand.textStrong }}>
          {botName}
        </span>
        <span style={{ fontFamily: brand.fontSans, fontSize: 12, color: brand.textMuted }}>{timestamp}</span>
      </div>

      {/* Summary header */}
      <div
        style={{
          background: brand.bg,
          borderRadius: 6,
          padding: "12px 14px",
          marginBottom: 10,
          fontFamily: brand.fontSans,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, color: brand.textStrong, marginBottom: 2 }}>
          📊 Daily Standup — {teamName}
        </div>
        <div style={{ fontSize: 13, color: brand.textMuted }}>📅 {date}</div>
        <div style={{ fontSize: 13, color: brand.textMuted }}>
          👥 {submitted}/{total} members responded
        </div>
      </div>

      {/* Response cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  </div>
);
