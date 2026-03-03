"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "saccoflow-theme";

type Theme = "light" | "dark";

const THEME_TOKENS: Record<Theme, Record<string, string>> = {
  light: {
    "--background": "#f2f5fb",
    "--foreground": "#172033",
    "--surface": "#ffffff",
    "--surface-soft": "#f5f8ff",
    "--border": "#d8dfed",
    "--accent": "#f0c619",
    "--accent-strong": "#d8b110",
    "--ring": "#f0c61966",
    "--muted": "#4f5d78",
    "--muted-soft": "#70819c",
    "--cta-text": "#1a2334",
  },
  dark: {
    "--background": "#131a2a",
    "--foreground": "#eef2fb",
    "--surface": "#1d2738",
    "--surface-soft": "#243042",
    "--border": "#2f3d52",
    "--accent": "#f4cc1f",
    "--accent-strong": "#deba13",
    "--ring": "#f4cc1f66",
    "--muted": "#b7c2d8",
    "--muted-soft": "#95a3bc",
    "--cta-text": "#1a2334",
  },
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  const tokens = THEME_TOKENS[theme];
  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(token, value);
  }
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
};

const safeReadTheme = (): Theme | null => {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    return null;
  }
  return null;
};

const safeWriteTheme = (theme: Theme) => {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // no-op when storage is unavailable
  }
};

const getInitialTheme = (): Theme => {
  const stored = safeReadTheme();
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const initial = getInitialTheme();
      setTheme(initial);
      applyTheme(initial);
    } finally {
      setReady(true);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    safeWriteTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={!ready}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold shadow-sm transition hover:bg-surface-soft disabled:opacity-50"
      aria-label="Toggle light and dark mode"
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
    </button>
  );
}
