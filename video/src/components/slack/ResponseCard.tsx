import React from "react";
import { brand } from "../../data/brand";

interface ResponseCardProps {
  member: { name: string; initials: string; avatarColor: string };
  yesterday: string;
  today: string;
  blockers: string;
}

const Row: React.FC<{ emoji: string; label: string; text: string }> = ({ emoji, label, text }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {emoji} {label}
    </div>
    <div style={{ fontSize: 14, color: brand.textPrimary, lineHeight: 1.5 }}>{text}</div>
  </div>
);

export const ResponseCard: React.FC<ResponseCardProps> = ({ member, yesterday, today, blockers }) => (
  <div
    style={{
      background: brand.bgSurface,
      borderRadius: 6,
      padding: "14px 16px",
      borderLeft: `3px solid ${member.avatarColor}`,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    {/* Member header */}
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          background: member.avatarColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#fff",
          fontFamily: brand.fontSans,
          flexShrink: 0,
        }}
      >
        {member.initials}
      </div>
      <span style={{ fontFamily: brand.fontSans, fontWeight: 700, fontSize: 15, color: brand.textStrong }}>
        {member.name}
      </span>
    </div>

    <Row emoji="📌" label="Last working day" text={yesterday} />
    <Row emoji="🎯" label="Today" text={today} />
    <Row emoji="🚧" label="Blockers" text={blockers} />
  </div>
);
