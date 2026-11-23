export const PALETTE = {
  paper: '#F5F1E8',
  card: '#FBF8F1',
  raised: '#EFE9DD',
  line: '#D9D2C6',
  lineSoft: '#E7E1D6',
  ink: '#202A2E',
  muted: '#5A6668',
  faint: '#666C68',
  teal: '#2F6F73',
  clay: '#A9583A',
  rust: '#9C3B32',
  sage: '#4F7A63',
  plum: '#6F5A86',
} as const;

export type PaletteColor = (typeof PALETTE)[keyof typeof PALETTE];
