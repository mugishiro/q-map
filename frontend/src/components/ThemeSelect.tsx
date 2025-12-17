import { useEffect, useState } from "react";
import { getStoredGrid, getStoredTheme, setGridVisible, setTheme, type ThemeOption } from "../theme";

export const ThemeSelect = () => {
  const [theme, setThemeState] = useState<ThemeOption>("light");
  const [grid, setGrid] = useState<boolean>(true);

  const applyTheme = (t: ThemeOption) => {
    setThemeState(t);
    setTheme(t);
  };

  const applyGrid = (on: boolean) => {
    setGrid(on);
    setGridVisible(on);
  };

  useEffect(() => {
    applyTheme(getStoredTheme());
    applyGrid(getStoredGrid());
  }, []);

  return (
    <div className="stack gap-s">
      <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 17h6m-5-2h4m-5-4.5a3 3 0 1 1 6 0c0 1.34-.64 2.28-1.35 2.93-.58.52-.65 1.39-.65 2.07v.5h-3v-.5c0-.68-.07-1.55-.65-2.07C9.64 12.78 9 11.84 9 10.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="label" style={{ margin: 0 }}>
            テーマ
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className={`btn ${theme === "light" ? "solid" : "ghost"}`} onClick={() => applyTheme("light")}>
            Light
          </button>
          <button className={`btn ${theme === "dark" ? "solid" : "ghost"}`} onClick={() => applyTheme("dark")}>
            Dark
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 5h4v4H5V5Zm0 10h4v4H5v-4Zm10-10h4v4h-4V5Zm0 10h4v4h-4v-4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="label" style={{ margin: 0 }}>
            グリッド
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className={`btn ${grid ? "solid" : "ghost"}`} onClick={() => applyGrid(true)}>
            ON
          </button>
          <button className={`btn ${!grid ? "solid" : "ghost"}`} onClick={() => applyGrid(false)}>
            OFF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSelect;
