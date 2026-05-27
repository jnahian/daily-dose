import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig, Audio, staticFile } from "remotion";
import { Background } from "../components/Background";
import { SlackModal } from "../components/slack/Modal";
import { MODAL_FIELDS } from "../data/script";

// Each field starts filling after a stagger offset (in frames) — scene is ~210f total
const FIELD_START = [15, 75, 135];
const FIELD_DURATION = 45;

export const Modal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleIn = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });

  const fillProgress = FIELD_START.map((start, i) =>
    interpolate(frame, [start, start + FIELD_DURATION], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })
  );

  const allFilled = fillProgress.every((p) => p >= 1);
  // Pulse submit button once all fields are done
  const submitPulse = allFilled && frame > FIELD_START[2] + FIELD_DURATION + 10;

  const fields = MODAL_FIELDS.map((f, i) => ({
    ...f,
    value: f.exampleValue,
    fillProgress: fillProgress[i],
  }));

  return (
    <Background>
      <Audio src={staticFile("vo/modal.mp3")} />
      <div style={{ transform: "scale(1.5)", transformOrigin: "center center" }}>
      <div style={{ transform: `scale(${scaleIn})` }}>
        <SlackModal
          title={`📊 Engineering — Tuesday, May 27`}
          fields={fields}
          submitPulse={submitPulse}
        />
      </div>
      </div>
    </Background>
  );
};
