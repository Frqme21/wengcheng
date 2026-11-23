/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        paper: 'oklch(0.9588 0.0127 86.8)',
        card: 'oklch(0.9795 0.0098 87.5)',
        raised: 'oklch(0.9354 0.0173 84.6)',
        line: 'oklch(0.8661 0.018 81.3)',
        'line-soft': 'oklch(0.9114 0.0162 82.8)',
        ink: 'oklch(0.2773 0.0157 224.2)',
        muted: 'oklch(0.5008 0.0151 208.7)',
        faint: 'oklch(0.5248 0.0096 156.9)',
        teal: 'oklch(0.5021 0.0651 200.9)',
        clay: 'oklch(0.5512 0.1149 40.6)',
        rust: 'oklch(0.4859 0.1315 28.2)',
        sage: 'oklch(0.541 0.0601 160.1)',
        plum: 'oklch(0.5058 0.0724 305.8)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
