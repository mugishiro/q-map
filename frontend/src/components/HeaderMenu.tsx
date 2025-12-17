import { useState } from "react";
import { api } from "../api";
import HeaderAuth from "./HeaderAuth";
import SettingsPanel from "./SettingsPanel";
import ThemeSelect from "./ThemeSelect";

type Props = {
  onAuthChange: () => void;
  onLoginSuccess: () => void;
  onLogout: () => void;
};

export const HeaderMenu = ({ onAuthChange, onLoginSuccess, onLogout }: Props) => {
  const [open, setOpen] = useState(false);
  const [showLlm, setShowLlm] = useState(false);
  const loggedIn = Boolean(api.getToken());
  const userLabel = loggedIn ? "ログイン中" : "未ログイン";
  return (
    <div className="settings-header">
      <button className="icon-btn" aria-label="設定" title="設定" onClick={() => setOpen((v) => !v)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M19.4 13.5c.04-.5.04-1 .04-1.5s0-1-.04-1.5l1.6-1.25a.5.5 0 0 0 .12-.64l-1.52-2.63a.5.5 0 0 0-.6-.22l-1.88.76a6.9 6.9 0 0 0-1.3-.75l-.28-2a.5.5 0 0 0-.5-.43h-3a.5.5 0 0 0-.5.43l-.28 2a6.9 6.9 0 0 0-1.3.75l-1.88-.76a.5.5 0 0 0-.6.22l-1.52 2.63a.5.5 0 0 0 .12.64l1.6 1.25c-.03.5-.03 1-.03 1.5s0 1 .03 1.5l-1.6 1.25a.5.5 0 0 0-.12.64l1.52 2.63a.5.5 0 0 0 .6.22l1.88-.76c.4.3.84.56 1.3.75l.28 2a.5.5 0 0 0 .5.43h3a.5.5 0 0 0 .5-.43l.28-2c.46-.2.9-.45 1.3-.75l1.88.76a.5.5 0 0 0 .6-.22l1.52-2.63a.5.5 0 0 0-.12-.64l-1.6-1.25Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="settings-popover card stack gap-m" style={{ minWidth: "320px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#e0f2fe",
                color: "#0ea5e9",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
              }}
            >
              Q
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>{userLabel}</span>
            </div>
            <button className="icon-btn" aria-label="閉じる" title="閉じる" onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
          <HeaderAuth onAuthChange={onAuthChange} onLoginSuccess={onLoginSuccess} onLogout={onLogout} />
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
          <ThemeSelect />
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
          <button className="btn solid" onClick={() => setShowLlm(true)}>
            LLM 設定を開く
          </button>
        </div>
      )}
      {showLlm && (
        <div className="modal-backdrop" onClick={() => setShowLlm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <SettingsPanel embedded hideTheme />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={() => setShowLlm(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderMenu;
