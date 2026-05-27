import React from "react";
import { Img, staticFile } from "remotion";
import { brand } from "../../data/brand";
import { SlackButton } from "./Button";

interface DmMessageProps {
  senderName: string;
  avatarBg: string;
  avatarEmoji: string;
  timestamp: string;
  message: string;
  button?: { label: string; variant?: "primary" | "default" };
  useLogo?: boolean;
}

export const DmMessage: React.FC<DmMessageProps> = ({
  senderName,
  avatarBg,
  avatarEmoji,
  timestamp,
  message,
  button,
  useLogo = false,
}) => (
  <div
    style={{
      display: "flex",
      gap: 12,
      padding: "16px 20px",
      background: brand.bgSurface,
      borderRadius: 8,
      maxWidth: 560,
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

    {/* Content */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontFamily: brand.fontSans,
            fontWeight: 700,
            fontSize: 15,
            color: brand.textStrong,
          }}
        >
          {senderName}
        </span>
        <span style={{ fontFamily: brand.fontSans, fontSize: 12, color: brand.textMuted }}>
          {timestamp}
        </span>
      </div>
      <div
        style={{
          fontFamily: brand.fontSans,
          fontSize: 15,
          color: brand.textPrimary,
          lineHeight: 1.5,
          marginBottom: button ? 12 : 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {message}
      </div>
      {button && <SlackButton label={button.label} variant={button.variant} />}
    </div>
  </div>
);
