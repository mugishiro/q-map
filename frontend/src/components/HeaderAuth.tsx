import { useMemo, useState } from "react";
import { api } from "../api";
import { auth } from "../auth";

type Props = {
  onAuthChange: () => void;
  onLoginSuccess?: () => void;
  onLogout?: () => void;
};

const HeaderAuth = ({ onAuthChange, onLoginSuccess, onLogout }: Props) => {
  const [token, setToken] = useState(api.getToken() || "");
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const isConfigured = useMemo(() => auth.isConfigured(), []);
  const loggedIn = Boolean(api.getToken());
  const statusLabel = loggedIn ? "ログイン済み" : "未ログイン";
  const statusColor = loggedIn ? "#16a34a" : "#475569";
  const statusBg = loggedIn ? "#dcfce7" : "#e2e8f0";

  const startLogin = async () => {
    setError(null);
    try {
      await auth.startLogin();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const logout = () => {
    api.clearToken();
    auth.clearAuthArtifacts();
    setToken("");
    onAuthChange();
    onLogout?.();
  };

  const saveManual = () => {
    api.setToken(token.trim());
    onAuthChange();
    onLoginSuccess?.();
  };

  return (
    <div className="auth-controls stack gap-s">
      <div className="label">認証</div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          className="auth-chip"
          style={{ background: statusBg, borderColor: statusBg, color: statusColor, fontWeight: 700 }}
        >
          {statusLabel}
        </span>
        <span className="helper-inline">{loggedIn ? "JWT 保持中" : "サインインしてください"}</span>
      </div>
      <div className="stack gap-xs">
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button className="btn solid" onClick={startLogin} disabled={!isConfigured || loggedIn}>
            ログイン
          </button>
          {loggedIn && (
            <button
              className="btn ghost"
              onClick={logout}
              style={{ borderColor: "#e11d48", color: "#e11d48", background: "transparent" }}
            >
              ログアウト
            </button>
          )}
          <button className="btn ghost" onClick={() => setShowManual((v) => !v)}>
            JWT 手動入力
          </button>
        </div>
        {showManual && (
          <div className="stack gap-xs">
            <label className="helper-inline" htmlFor="manual-jwt">
              デバッグ/非常時のみ利用（通常はログインを推奨）
            </label>
            <div className="manual-auth" style={{ flexWrap: "wrap", gap: "6px" }}>
              <input
                id="manual-jwt"
                className="input"
                style={{ width: "240px" }}
                placeholder="JWT を貼り付け"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button className="btn" onClick={saveManual}>
                保存
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <span className="helper-inline" style={{ color: "#b91c1c" }}>{error}</span>}
    </div>
  );
};

export default HeaderAuth;
