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
      <div className="stack gap-xs">
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {loggedIn ? (
            <button
              className="btn ghost"
              onClick={logout}
              style={{ borderColor: "#e11d48", color: "#e11d48", background: "transparent" }}
            >
              ログアウト
            </button>
          ) : (
            <button className="btn solid" onClick={startLogin} disabled={!isConfigured}>
              ログイン
            </button>
          )}
          <button className="btn ghost" onClick={() => setShowManual((v) => !v)}>
            JWT 手動入力
          </button>
        </div>
        {showManual && (
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
        )}
      </div>
      {error && <span style={{ color: "#b91c1c", fontSize: "12px" }}>{error}</span>}
    </div>
  );
};

export default HeaderAuth;
