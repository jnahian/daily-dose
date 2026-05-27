import React from "react";
import { useCurrentFrame, interpolate, Audio, staticFile, Img } from "remotion";
import { Background } from "../components/Background";
import { BOT, TEAM, MEMBERS } from "../data/bot";
import { brand } from "../data/brand";

const CARD_START = [20, 60, 100];

const Row: React.FC<{ emoji: string; label: string; text: string }> = ({ emoji, label, text }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ fontSize: 13, color: brand.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {emoji} {label}
    </div>
    <div style={{ fontSize: 17, color: brand.textPrimary, lineHeight: 1.5 }}>{text}</div>
  </div>
);

export const Summary: React.FC = () => {
  const frame = useCurrentFrame();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const cardStyles = CARD_START.map((start) => ({
    opacity: interpolate(frame, [start, start + 25], [0, 1], { extrapolateRight: "clamp" }),
    y: interpolate(frame, [start, start + 25], [32, 0], { extrapolateRight: "clamp" }),
  }));

  return (
    <Background>
      <Audio src={staticFile("vo/summary.mp3")} />

      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "48px 72px",
          gap: 28,
          boxSizing: "border-box",
        }}
      >
        {/* Channel header */}
        <div
          style={{
            opacity: headerOpacity,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Img
            src={staticFile("logo.png")}
            style={{ width: 52, height: 52, borderRadius: 10 }}
          />
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: brand.textStrong, fontFamily: brand.fontSans }}>
              📊 Daily Standup — {TEAM.name}
            </div>
            <div style={{ fontSize: 16, color: brand.textMuted, fontFamily: brand.fontSans, marginTop: 2 }}>
              📅 {TEAM.date} &nbsp;·&nbsp; 👥 {MEMBERS.length}/{MEMBERS.length} members responded &nbsp;·&nbsp; # engineering
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ opacity: headerOpacity, height: 1, background: brand.border }} />

        {/* Three cards side by side */}
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          {MEMBERS.map((member, i) => (
            <div
              key={member.name}
              style={{
                flex: "0 1 calc(33.33% - 16px)",
                opacity: cardStyles[i].opacity,
                transform: `translateY(${cardStyles[i].y}px)`,
                background: brand.bgSurface,
                borderRadius: 12,
                borderLeft: `4px solid ${member.avatarColor}`,
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {/* Member name */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: member.avatarColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#fff",
                    fontFamily: brand.fontSans,
                    flexShrink: 0,
                  }}
                >
                  {member.initials}
                </div>
                <span style={{ fontFamily: brand.fontSans, fontWeight: 700, fontSize: 20, color: brand.textStrong }}>
                  {member.name}
                </span>
              </div>

              <Row emoji="📌" label="Last working day" text={member.yesterday} />
              <Row emoji="🎯" label="Today" text={member.today} />
              <Row emoji="🚧" label="Blockers" text={member.blockers} />
            </div>
          ))}
        </div>
      </div>
    </Background>
  );
};
