export type ThemeOption = "light" | "dark";

const THEME_KEY = "qmap_theme";

export const setTheme = (theme: ThemeOption) => {
  document.documentElement.setAttribute("data-theme", theme);
  document.body?.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
};

export const getStoredTheme = (): ThemeOption => {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "light" ? stored : "light";
};

export const initTheme = () => {
  setTheme(getStoredTheme());
};
