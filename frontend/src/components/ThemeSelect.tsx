import { useEffect, useState } from "react";

export const ThemeSelect = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    document.body?.setAttribute("data-theme", t);
    localStorage.setItem("qmap_theme", t);
  };

  useEffect(() => {
    const stored = localStorage.getItem("qmap_theme");
    const t = stored === "dark" || stored === "light" ? stored : "light";
    applyTheme(t);
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
