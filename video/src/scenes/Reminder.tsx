import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Audio, staticFile } from "remotion";
import { Background } from "../components/Background";
import { DmMessage } from "../components/slack/DmMessage";
import { BOT } from "../data/bot";
import { brand } from "../data/brand";

export const Reminder: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideY = interpolate(frame, [0, 25], [60, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Button pulse starts at frame 120 (end of DM read time)
  const buttonPulse = frame > 120 && Math.sin((frame - 120) * 0.2) > 0.5;

  // Context label
  const labelOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });

  return (
    <Background>
      <Audio src={staticFile("vo/reminder.mp3")} />
      <div style={{ transform: "scale(1.5)", transformOrigin: "center center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          transform: `translateY(${slideY}px)`,
          opacity,
        }}
      >
        {/* Slack DM context label */}
        <div
          style={{
            opacity: labelOpacity,
            fontSize: 14,
            color: brand.textMuted,
            fontFamily: brand.fontSans,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          📩 Direct Message · 9:00 AM
        </div>

        <DmMessage
          senderName={BOT.name}
          avatarBg={BOT.avatarBg}
          avatarEmoji={BOT.avatarEmoji}
          timestamp="9:00 AM"
          message={`Good morning! ☀️ Time for your daily standup.\n\nShare what you're working on with your team.`}
          button={{ label: "📝 Submit Standup", variant: "primary" }}
          useLogo
        />
      </div>
      </div>
    </Background>
  );
};
