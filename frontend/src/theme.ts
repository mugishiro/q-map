export type ThemeOption = "light" | "dark";

const THEME_KEY = "qmap_theme";
const GRID_KEY = "qmap_grid";

export const setTheme = (theme: ThemeOption) => {
  document.documentElement.setAttribute("data-theme", theme);
  document.body?.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
};

export const getStoredTheme = (): ThemeOption => {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "light" ? stored : "light";
};

export const setGridVisible = (on: boolean) => {
  const value = on ? "on" : "off";
  document.documentElement.setAttribute("data-grid", value);
  document.body?.setAttribute("data-grid", value);
  localStorage.setItem(GRID_KEY, value);
};

export const getStoredGrid = (): boolean => {
  const stored = localStorage.getItem(GRID_KEY);
  if (stored === "on") return true;
  if (stored === "off") return false;
  return true;
};

export const initTheme = () => {
  setTheme(getStoredTheme());
  setGridVisible(getStoredGrid());
};
