import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Audio, staticFile } from "remotion";
import { Background } from "../components/Background";
import { LogoMark } from "../components/LogoMark";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const taglineOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [20, 45], [20, 0], { extrapolateRight: "clamp" });

  return (
    <Background>
      <Audio src={staticFile("vo/hook.mp3")} />
      <div style={{ transform: "scale(1.5)", transformOrigin: "center center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          transform: `scale(${logoScale})`,
        }}
      >
        <LogoMark size={120} />
        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            fontSize: 32,
            color: "#9ca3af",
            fontFamily: "'Inter', sans-serif",
            letterSpacing: "0.04em",
          }}
        >
          Standups without the meeting
        </div>
      </div>
      </div>
    </Background>
  );
};
