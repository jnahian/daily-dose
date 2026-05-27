// Single source of truth for all copy — VO lines, captions, and on-screen text.
// Edit here, then run `npm run video:vo` to regenerate audio before re-rendering.

export const SCRIPT = {
  hook: {
    vo: "Meet Daily Dose — standups without the meeting.",
    caption: "Standups without the meeting.",
  },
  reminder: {
    vo: "Every morning, Daily Dose sends you a quick DM at standup time.",
    caption: "Your daily reminder arrives by DM.",
  },
  modal: {
    vo: "One click opens your standup. Fill in three quick fields and you're done.",
    caption: "Fill in three quick fields.",
  },
  commands: {
    vo: "A handful of slash commands put everything else at your fingertips.",
    caption: "Everything at your fingertips.",
  },
  summary: {
    vo: "Responses post automatically to your team channel — no meeting required.",
    caption: "Your team sees everyone's update, together.",
  },
  cta: {
    vo: "You're all set. Watch for your first reminder.",
    caption: "Watch for your first reminder.",
  },
};

export const MODAL_FIELDS = [
  {
    label: "Last Working Day's Tasks",
    placeholder: "What did you work on your last working day?",
    exampleValue: "Reviewed PR #241, updated deployment docs",
  },
  {
    label: "Today's Tasks",
    placeholder: "What will you work on today?",
    exampleValue: "Ship the auth refactor, sync with design",
  },
  {
    label: "Blockers",
    placeholder: "Any blockers or help needed?",
    exampleValue: "Waiting on design review for the modal",
  },
];

// Caption timing in frames (30fps). Keep in sync with scene durations in MainVideo.tsx.
export const CAPTION_SCHEDULE = [
  { key: "hook",     startFrame: 8,   endFrame: 55  },
  { key: "reminder", startFrame: 70,  endFrame: 170 },
  { key: "modal",    startFrame: 190, endFrame: 380 },
  // commands scene captions handled internally via progress pips — no global caption shown
  { key: "summary",  startFrame: 1300, endFrame: 1490 },
  { key: "cta",      startFrame: 1510, endFrame: 1610 },
] as const;
