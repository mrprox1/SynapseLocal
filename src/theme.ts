import { useEffect, useState } from "react";

// Light/dark via shadcn's `dark` class on <html>. "system" follows the OS live.
// localStorage (sync) so the right theme is applied before first paint.
export type ThemeMode = "system" | "light" | "dark";

const KEY = "theme";
const mq = window.matchMedia("(prefers-color-scheme: dark)");

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const apply = () => {
  const m = getThemeMode();
  document.documentElement.classList.toggle("dark", m === "dark" || (m === "system" && mq.matches));
};

export function setThemeMode(m: ThemeMode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    // storage unavailable: the choice lasts for this session only
  }
  apply();
}

export function initTheme() {
  apply();
  mq.addEventListener("change", apply);
}

/** True while the `dark` class is on <html>. */
export function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
