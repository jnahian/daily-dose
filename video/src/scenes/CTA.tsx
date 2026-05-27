import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Audio, staticFile } from "remotion";
import { Background } from "../components/Background";
import { LogoMark } from "../components/LogoMark";
import { brand } from "../data/brand";

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const textOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(frame, [20, 50], [20, 0], { extrapolateRight: "clamp" });

  return (
    <Background>
      <Audio src={staticFile("vo/cta.mp3")} />
      <div style={{ transform: "scale(1.5)", transformOrigin: "center center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        <div style={{ transform: `scale(${logoScale})` }}>
          <LogoMark size={100} />
        </div>

        <div
          style={{
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: brand.textStrong,
              fontFamily: brand.fontSans,
              letterSpacing: "-0.02em",
            }}
          >
            You're all set.
          </div>
          <div
            style={{
              fontSize: 22,
              color: brand.textMuted,
              fontFamily: brand.fontSans,
            }}
          >
            Watch for your first reminder.
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 16,
              color: brand.accent,
              fontFamily: brand.fontSans,
              letterSpacing: "0.01em",
            }}
          >
            dd.jnahian.me
          </div>
        </div>
      </div>
      </div>
    </Background>
  );
};
