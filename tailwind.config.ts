import type { Config } from 'tailwindcss';
// Same palette and type as the public site (site/assets/site.css).
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0C', paper: '#FFFFFF', pink: { DEFAULT: '#FFA3CB', ink: '#A8235A', mid: '#D77FA6', deep: '#7A4A5F' },
        wash: '#FFF2F7', line: '#EADDE3', muted: '#5E5459', night: { DEFAULT: '#0B0B0C', muted: '#A99EA3', line: '#2E2629' },
        good: '#1F7A4D', bad: '#B3261E', hold: '#8A5A00',
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'Arial Narrow', 'sans-serif'],
        sans: ['IBM Plex Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: { stamp: '8px 8px 0 #FFA3CB', lift: '4px 4px 0 #0B0B0C' },
    },
  },
  plugins: [],
} satisfies Config;
