export type ThemeTokenMap = Record<`--${string}`, string>;

export interface ThemeTokenConfig {
  root: ThemeTokenMap;
  fontScale: {
    small: ThemeTokenMap;
    large: ThemeTokenMap;
  };
  media: {
    desktop: ThemeTokenMap;
  };
}

const THEME_STYLE_ID = "raw-pair-cleaner-theme-tokens";

export const defaultThemeTokens: ThemeTokenConfig = {
  root: {
    "--font-family-ui": '"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "--color-bg": "#f5f8fb",
    "--color-bg-deep": "#eaf1f6",
    "--color-bg-mid": "#f9fbfd",
    "--color-surface": "#f8fbfd",
    "--color-surface-strong": "#ffffff",
    "--color-surface-soft": "#f2f7fa",
    "--color-surface-tint": "#edf5f9",
    "--color-surface-hover": "#fbfdfe",
    "--color-content-wash": "#f4f8fb",
    "--color-border": "#d7e3ea",
    "--color-border-strong": "#c1d1db",
    "--color-text": "#27343d",
    "--color-heading": "#17242c",
    "--color-muted": "#5a6c78",
    "--color-subtle": "#82919a",
    "--color-primary": "#3f7fa0",
    "--color-primary-strong": "#235d78",
    "--color-primary-soft": "#dceef7",
    "--color-primary-ring": "rgba(77, 143, 178, 0.28)",
    "--color-accent-blue": "#35799b",
    "--color-accent-blue-strong": "#286783",
    "--color-accent-blue-soft": "#daeff8",
    "--color-accent-blue-border": "rgba(83, 143, 172, 0.28)",
    "--color-accent-blue-hover-bg": "rgba(205, 234, 246, 0.9)",
    "--color-warning": "#8a531f",
    "--color-warning-strong": "#b66b1e",
    "--color-warning-soft": "#fff0d9",
    "--color-warning-border": "#e7c188",
    "--color-danger": "#c95b62",
    "--color-danger-hover": "#b54d52",
    "--color-danger-strong": "#963940",
    "--color-danger-soft": "#f9e2e4",
    "--color-danger-border": "#e7b8bc",
    "--color-glass-highlight": "#ffffff",
    "--color-glass-shadow": "rgba(52, 77, 96, 0.12)",
    "--color-on-primary": "#ffffff",
    "--color-status-bg": "#ffffff",
    "--color-scrim": "rgba(30, 41, 59, 0.44)",
    "--color-directory-separate-bg": "#eff6ff",
    "--color-directory-separate-text": "#1d4ed8",
    "--color-directory-separate-ring": "#bfdbfe",
    "--color-directory-mixed-bg": "#f0fdf4",
    "--color-directory-mixed-text": "#15803d",
    "--color-directory-mixed-ring": "#bbf7d0",
    "--color-directory-manual-bg": "#fff7ed",
    "--color-directory-manual-text": "#c2410c",
    "--color-directory-manual-ring": "#fed7aa",
    "--radius-sm": "0.5rem",
    "--radius-md": "0.75rem",
    "--radius-lg": "1rem",
    "--radius-xl": "1.125rem",
    "--radius-shell": "1.25rem",
    "--shadow-window": "0 24px 80px rgba(15, 23, 42, 0.18)",
    "--shadow-panel": "0 10px 28px rgba(52, 77, 96, 0.07)",
    "--shadow-float": "0 24px 70px rgba(31, 56, 74, 0.2)",
    "--shadow-primary-control": "0 8px 18px rgba(63, 127, 160, 0.18)",
    "--shadow-danger-control": "0 8px 18px rgba(157, 63, 68, 0.14)",
    "--shadow-subtle": "0 1px 2px rgba(15, 23, 42, 0.05)",
    "--shadow-selected-mode": "0 14px 34px rgba(63, 127, 160, 0.14)",
    "--glass-blur": "blur(6px) saturate(108%)",
    "--glass-blur-soft": "blur(6px) saturate(108%)",
    "--gradient-app-bg": "radial-gradient(circle at 8% 8%, rgba(111, 163, 198, 0.07), transparent 30rem), linear-gradient(145deg, var(--color-bg) 0%, var(--color-bg-mid) 52%, var(--color-bg-deep) 100%)",
    "--gradient-actionbar": "linear-gradient(180deg, rgba(248, 251, 253, 0.86), var(--color-surface))",
    "--space-page": "1rem",
    "--space-panel": "1rem",
    "--space-card": "0.875rem",
    "--control-sm": "2.25rem",
    "--control-md": "2.5rem",
    "--control-lg": "2.75rem",
    "--duration-fast": "160ms",
    "--z-overlay": "50",
    "--font-page-title": "1.5rem",
    "--font-page-subtitle": "0.875rem",
    "--font-section-title": "1.0625rem",
    "--font-card-title": "0.875rem",
    "--font-stat": "1.625rem",
    "--font-stat-strong": "1.875rem",
    "--font-body": "0.8125rem",
    "--font-ui": "0.8125rem",
    "--font-caption": "0.71875rem",
    "--font-nav": "0.875rem"
  },
  fontScale: {
    small: {
      "--font-page-title": "1.375rem",
      "--font-page-subtitle": "0.8125rem",
      "--font-section-title": "1rem",
      "--font-card-title": "0.8125rem",
      "--font-stat": "1.5rem",
      "--font-stat-strong": "1.75rem",
      "--font-body": "0.78125rem",
      "--font-ui": "0.78125rem",
      "--font-caption": "0.6875rem",
      "--font-nav": "0.8125rem"
    },
    large: {
      "--font-page-title": "1.75rem",
      "--font-page-subtitle": "0.9375rem",
      "--font-section-title": "1.1875rem",
      "--font-card-title": "1rem",
      "--font-stat": "1.875rem",
      "--font-stat-strong": "2.125rem",
      "--font-body": "0.9375rem",
      "--font-ui": "0.9375rem",
      "--font-caption": "0.8125rem",
      "--font-nav": "1rem"
    }
  },
  media: {
    desktop: {
      "--space-page": "1.125rem"
    }
  }
};

export function applyThemeTokens(target: HTMLElement, tokens: ThemeTokenConfig = defaultThemeTokens) {
  applyTokenMap(target.style, tokens.root);
  syncThemeStyle(target.ownerDocument, tokens);
}

function applyTokenMap(style: CSSStyleDeclaration, tokens: ThemeTokenMap) {
  for (const [name, value] of Object.entries(tokens)) {
    style.setProperty(name, value);
  }
}

function syncThemeStyle(document: Document, tokens: ThemeTokenConfig) {
  let style = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement("style");
    style.id = THEME_STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = [
    `[data-font-scale="small"] { ${toCssDeclarations(tokens.fontScale.small)} }`,
    `[data-font-scale="large"] { ${toCssDeclarations(tokens.fontScale.large)} }`,
    `@media (min-width: 1200px) { :root { ${toCssDeclarations(tokens.media.desktop)} } }`
  ].join("\n");
}

function toCssDeclarations(tokens: ThemeTokenMap) {
  return Object.entries(tokens)
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");
}
