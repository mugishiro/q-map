import { useState } from "react";
import HeaderAuth from "./HeaderAuth";
import SettingsPanel from "./SettingsPanel";

type Props = {
  onAuthChange: () => void;
  onLoginSuccess: () => void;
  onLogout: () => void;
};

export const HeaderMenu = ({ onAuthChange, onLoginSuccess, onLogout }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="settings-header">
      <button className="btn ghost" onClick={() => setOpen((v) => !v)}>
        {open ? "閉じる" : "設定"}
      </button>
      {open && (
        <div className="settings-popover card stack gap-m">
          <HeaderAuth onAuthChange={onAuthChange} onLoginSuccess={onLoginSuccess} onLogout={onLogout} />
          <SettingsPanel embedded />
        </div>
      )}
    </div>
  );
};

export default HeaderMenu;
