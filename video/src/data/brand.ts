// Mirrors web/src/index.css @theme tokens — update both if branding changes
export const brand = {
  cyan: "#00cfff",
  blue: "#00afff",
  navy: "#0b1120",
  navyLight: "#151e32",
  accent: "#38bdf8",
  fontSans: "'Inter', sans-serif",
  // Video renders on dark background to match Slack's dark theme aesthetic
  bg: "#1a1d21",          // Slack dark sidebar bg
  bgSurface: "#222529",   // Slack dark message bg
  bgModal: "#1e2124",     // Slack dark modal bg
  textPrimary: "#d1d2d3",
  textStrong: "#ffffff",
  textMuted: "#9b9c9e",
  border: "#36393f",
  slackGreen: "#007a5a",  // Slack primary green for buttons
  slackBlue: "#1264a3",   // Slack link/mention color
  botAvatarBg: "#2c3e50", // from slack-app-manifest.json background_color
};
