export interface Theme {
  // Backgrounds
  bg: string;
  bgCard: string;
  bgCardDeep: string;
  bgInput: string;
  bgBadge: string;
  bgWarning: string;
  // Borders / dividers
  border: string;
  divider: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  // Accents
  accent: string;       // coral/salmon — primary CTA
  accentViolet: string; // violet/indigo — secondary
  accentGreen: string;
  accentOrange: string;
  accentRed: string;
  // Gradient blob color (decorative top-right)
  blob: string;
  blobInner: string;
  // Tab bar
  tabBar: string;
  tabActive: string;
  tabInactive: string;
}

export const DARK: Theme = {
  bg: '#14112b',
  bgCard: '#1e1a38',
  bgCardDeep: '#14112b',
  bgInput: '#252046',
  bgBadge: '#2a2550',
  bgWarning: '#1e1040',
  border: '#3b3470',
  divider: '#2e2a52',
  textPrimary: '#ffffff',
  textSecondary: '#cccaec',
  textMuted: '#8880b8',
  textFaint: '#5550a0',
  accent: '#f26e7e',
  accentViolet: '#a89af0',
  accentGreen: '#4cd98a',
  accentOrange: '#f5a623',
  accentRed: '#ff6b35',
  blob: '#6c5ce7',
  blobInner: '#a89af0',
  tabBar: '#1e1a38',
  tabActive: '#f26e7e',
  tabInactive: '#5550a0',
};

export const LIGHT: Theme = {
  bg: '#f0eef8',
  bgCard: '#ffffff',
  bgCardDeep: '#f0eef8',
  bgInput: '#e8e5f4',
  bgBadge: '#ece9f8',
  bgWarning: '#f0eeff',
  border: '#d4cff0',
  divider: '#e2dff4',
  textPrimary: '#1a1640',
  textSecondary: '#3a3660',
  textMuted: '#7070a8',
  textFaint: '#a8a4cc',
  accent: '#f26e7e',
  accentViolet: '#7c6ff7',
  accentGreen: '#2abb74',
  accentOrange: '#e0900a',
  accentRed: '#e05520',
  blob: '#b8acf5',
  blobInner: '#d4cff0',
  tabBar: '#ffffff',
  tabActive: '#f26e7e',
  tabInactive: '#a8a4cc',
};

export const THEMES = { dark: DARK, light: LIGHT };
