/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        paper: '#F5F1E8',
        card: '#FBF8F1',
        raised: '#EFE9DD',
        line: '#D9D2C6',
        'line-soft': '#E7E1D6',
        ink: '#202A2E',
        muted: '#5A6668',
        faint: '#8A8F8B',
        teal: '#2F6F73',
        clay: '#A9583A',
        rust: '#9C3B32',
        sage: '#4F7A63',
        plum: '#6F5A86',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
