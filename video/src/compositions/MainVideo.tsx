import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile } from "remotion";
import { Hook } from "../scenes/Hook";
import { Reminder } from "../scenes/Reminder";
import { Modal } from "../scenes/Modal";
import { Commands } from "../scenes/Commands";
import { Summary } from "../scenes/Summary";
import { CTA } from "../scenes/CTA";
import { Caption } from "../components/Caption";

// Scene timing @ 30fps
// Hook      0–60    2s
// Reminder  60–180  4s
// Modal     180–390 7s
// Commands  390–1290 30s  (6 command slides × 150f each)
// Summary   1290–1500 7s
// CTA       1500–1620 4s
// Total     1620f = 54s
export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("Soft Launch Glow.mp3")} volume={0.12} />
    <Sequence from={0}    durationInFrames={60}><Hook /></Sequence>
    <Sequence from={60}   durationInFrames={120}><Reminder /></Sequence>
    <Sequence from={180}  durationInFrames={210}><Modal /></Sequence>
    <Sequence from={390}  durationInFrames={900}><Commands /></Sequence>
    <Sequence from={1290} durationInFrames={210}><Summary /></Sequence>
    <Sequence from={1500} durationInFrames={120}><CTA /></Sequence>
    <Caption />
  </AbsoluteFill>
);
