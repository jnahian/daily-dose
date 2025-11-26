import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'slack-purple': '#4A154B',
        'slack-green': '#007A5A',
        'slack-blue': '#1264A3',
        'primary': '#00CFFF',
        'secondary': '#00AFFF',
        'glow': '#007BFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
