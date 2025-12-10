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
    <div className="auth-controls">
      <span className="auth-chip">{loggedIn ? "ログイン済み" : "未ログイン"}</span>
      <button className="btn solid" onClick={startLogin} disabled={!isConfigured}>
        ログイン
      </button>
      {loggedIn && (
        <button className="btn ghost" onClick={logout}>
          ログアウト
        </button>
      )}
      <button className="btn ghost" onClick={() => setShowManual((v) => !v)}>
        トークン手動
      </button>
      {showManual && (
        <div className="manual-auth">
          <input
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
      {!isConfigured && <span className="helper-inline">Cognito設定が不足しています</span>}
      {error && <span className="helper-inline" style={{ color: "#b91c1c" }}>{error}</span>}
    </div>
  );
};

export default HeaderAuth;
