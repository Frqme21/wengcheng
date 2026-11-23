/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        // Weng2 dark palette
        bg: 'oklch(0.13 0.012 235)',
        deep: 'oklch(0.1 0.012 235)',
        surface: 'oklch(0.19 0.014 235)',
        'surface-2': 'oklch(0.25 0.016 235)',
        line: 'oklch(0.33 0.016 235)',
        ink: 'oklch(0.96 0.01 90)',
        muted: 'oklch(0.76 0.015 235)',
        accent: 'oklch(0.72 0.17 45)',
        'accent-ink': 'oklch(0.18 0.03 45)',
        pass: 'oklch(0.72 0.13 235)',
        court: 'oklch(0.2 0.04 45)',
        'court-2': 'oklch(0.26 0.05 45)',
        // Legacy tokens remapped to dark theme
        paper: 'oklch(0.13 0.012 235)',
        card: 'oklch(0.19 0.014 235)',
        raised: 'oklch(0.25 0.016 235)',
        'line-soft': 'oklch(0.33 0.016 235)',
        faint: 'oklch(0.76 0.015 235)',
        teal: 'oklch(0.72 0.17 45)',
        clay: 'oklch(0.72 0.13 235)',
        rust: 'oklch(0.72 0.17 45)',
        sage: 'oklch(0.72 0.13 235)',
        plum: 'oklch(0.78 0.08 305)',
      },
      fontFamily: {
        display: ['"Fraunces"', '"Noto Serif SC"', 'serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        lsp: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
