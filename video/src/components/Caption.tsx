import React from "react";
import { useCurrentFrame } from "remotion";
import { brand } from "../data/brand";
import { CAPTION_SCHEDULE, SCRIPT } from "../data/script";

export const Caption: React.FC = () => {
  const frame = useCurrentFrame();

  const active = CAPTION_SCHEDULE.find(
    (c) => frame >= c.startFrame && frame <= c.endFrame
  );
  if (!active) return null;

  const text = SCRIPT[active.key].caption;
  const fadeInEnd = active.startFrame + 10;
  const fadeOutStart = active.endFrame - 10;

  let opacity = 1;
  if (frame < fadeInEnd) opacity = (frame - active.startFrame) / 10;
  if (frame > fadeOutStart) opacity = (active.endFrame - frame) / 10;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.72)",
        color: brand.textStrong,
        fontFamily: brand.fontSans,
        fontSize: 28,
        fontWeight: 500,
        padding: "10px 28px",
        borderRadius: 8,
        opacity,
        whiteSpace: "nowrap",
        letterSpacing: "-0.01em",
      }}
    >
      {text}
    </div>
  );
};
