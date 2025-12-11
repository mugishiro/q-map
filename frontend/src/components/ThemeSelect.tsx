import { useEffect, useState } from "react";
import { getStoredTheme, setTheme, type ThemeOption } from "../theme";

export const ThemeSelect = () => {
  const [theme, setThemeState] = useState<ThemeOption>("light");

  const applyTheme = (t: ThemeOption) => {
    setThemeState(t);
    setTheme(t);
  };

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return (
    <div className="stack gap-xs">
      <div className="label">テーマ</div>
      <select className="input" value={theme} onChange={(e) => applyTheme(e.target.value as "light" | "dark")}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <span className="helper-inline">切り替えで即時反映（保存不要）</span>
    </div>
  );
};

export default ThemeSelect;
