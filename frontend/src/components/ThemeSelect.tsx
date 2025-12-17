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
      <div className="label">表示</div>
      <select className="input" value={theme} onChange={(e) => applyTheme(e.target.value as "light" | "dark")}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <div style={{ display: "flex", gap: "8px" }}>
        <button className={`btn ${grid ? "solid" : "ghost"}`} onClick={() => applyGrid(true)} style={{ flex: 1 }}>
          グリッド ON
        </button>
        <button className={`btn ${!grid ? "solid" : "ghost"}`} onClick={() => applyGrid(false)} style={{ flex: 1 }}>
          グリッド OFF
        </button>
      </div>
    </div>
  );
};

export default ThemeSelect;
