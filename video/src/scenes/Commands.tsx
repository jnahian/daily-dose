import React from "react";
import { useCurrentFrame, interpolate, Audio, staticFile, Sequence, Img } from "remotion";
import { Background } from "../components/Background";
import { brand } from "../data/brand";

interface CommandDef {
  cmd: string;
  desc: string;
  examples: string[];
  voKey: string;
}

const COMMANDS: CommandDef[] = [
  {
    cmd: "/dd-standup",
    desc: "Submit your standup manually at any time — in your team channel or from anywhere.",
    examples: ["/dd-standup", "/dd-standup Engineering"],
    voKey: "cmd_standup",
  },
  {
    cmd: "/dd-standup-update",
    desc: "Edit your standup for today or any past date. Opens pre-filled with your existing response.",
    examples: ["/dd-standup-update", "/dd-standup-update 2024-01-15"],
    voKey: "cmd_standup_update",
  },
  {
    cmd: "/dd-standup-reminder",
    desc: "Control your reminder preferences — toggle mentions or turn all notifications on/off.",
    examples: ["/dd-standup-reminder notify=off", "/dd-standup-reminder mention=off notify=off"],
    voKey: "cmd_standup_reminder",
  },
  {
    cmd: "/dd-standup-history",
    desc: "View your past standup submissions across all teams — last day, a specific date, or a range.",
    examples: ["/dd-standup-history", "/dd-standup-history 2024-12-15 2024-12-20"],
    voKey: "cmd_standup_history",
  },
  {
    cmd: "/dd-leave-set",
    desc: "Mark yourself as on leave. Standups are skipped automatically during your leave dates.",
    examples: ["/dd-leave-set 2024-12-25 Holiday", "/dd-leave-set 2024-12-23 2024-12-27 Holiday break"],
    voKey: "cmd_leave_set",
  },
  {
    cmd: "/dd-leave-list",
    desc: "See all your upcoming and past leave dates in one place.",
    examples: ["/dd-leave-list"],
    voKey: "cmd_leave_list",
  },
];

// Each slide occupies this many frames (5s)
const SLIDE_DURATION = 150;
const FADE = 8; // frames to fade in / out

interface SlideProps {
  item: CommandDef;
  localFrame: number;
}

const CommandSlide: React.FC<SlideProps> = ({ item, localFrame }) => {
  const fadeInOpacity = interpolate(localFrame, [0, FADE], [0, 1], { extrapolateRight: "clamp" });
  const fadeOutOpacity = interpolate(localFrame, [SLIDE_DURATION - FADE, SLIDE_DURATION], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);
  const y = interpolate(localFrame, [0, FADE], [24, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 20,
        width: "100%",
        maxWidth: 820,
        padding: "0 60px",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, alignSelf: "center", marginBottom: 8 }}>
        <Img
          src={staticFile("logo.png")}
          style={{ width: 48, height: 48, borderRadius: 10 }}
        />
        <span style={{ fontFamily: brand.fontSans, fontSize: 22, fontWeight: 700, color: brand.textStrong }}>
          Daily Dose
        </span>
      </div>

      {/* Progress pips */}
      <div style={{ display: "flex", gap: 8, alignSelf: "center", marginBottom: 4 }}>
        {COMMANDS.map((_, i) => {
          const active = COMMANDS.indexOf(item) === i;
          return (
            <div
              key={i}
              style={{
                width: active ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: active ? brand.cyan : brand.border,
                transition: "width 0.3s",
              }}
            />
          );
        })}
      </div>

      {/* Command name */}
      <div
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 40,
          fontWeight: 700,
          color: brand.cyan,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {item.cmd}
      </div>

      {/* Description */}
      <div
        style={{
          fontFamily: brand.fontSans,
          fontSize: 22,
          color: brand.textPrimary,
          lineHeight: 1.55,
          maxWidth: 680,
        }}
      >
        {item.desc}
      </div>

      {/* Examples */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: brand.textMuted,
            fontFamily: brand.fontSans,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Examples
        </div>
        {item.examples.map((ex) => (
          <div
            key={ex}
            style={{
              background: brand.bgSurface,
              border: `1px solid ${brand.border}`,
              borderLeft: `3px solid ${brand.accent}`,
              borderRadius: 6,
              padding: "10px 16px",
              fontFamily: "'Courier New', monospace",
              fontSize: 17,
              color: brand.accent,
            }}
          >
            {ex}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Commands: React.FC = () => {
  const frame = useCurrentFrame();
  const slideIndex = Math.min(Math.floor(frame / SLIDE_DURATION), COMMANDS.length - 1);
  const localFrame = frame - slideIndex * SLIDE_DURATION;

  return (
    <Background>
      {/* One audio clip per slide, starting at its slide's frame offset */}
      {COMMANDS.map((item, i) => (
        <Sequence key={item.voKey} from={i * SLIDE_DURATION} durationInFrames={SLIDE_DURATION}>
          <Audio src={staticFile(`vo/${item.voKey}.mp3`)} />
        </Sequence>
      ))}
      <div style={{ transform: "scale(1.5)", transformOrigin: "center center" }}>
        <CommandSlide item={COMMANDS[slideIndex]} localFrame={localFrame} />
      </div>
    </Background>
  );
};
