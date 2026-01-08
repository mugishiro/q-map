import { useMemo, useState } from "react";
import { api } from "../api";
import { auth } from "../auth";

type Props = { onTokenSaved: () => void };

export const TokenBar = ({ onTokenSaved }: Props) => {
  const [token, setToken] = useState(api.getToken() || "");
  const [authError, setAuthError] = useState<string | null>(null);

  const cognitoConfigured = useMemo(() => auth.isConfigured(), []);

  const save = () => {
    api.setToken(token.trim());
    onTokenSaved();
  };

  const logout = () => {
    api.clearToken();
    auth.clearAuthArtifacts();
    setToken("");
    onTokenSaved();
    const logoutUrl = auth.getLogoutUrl();
    if (logoutUrl) {
      window.location.href = logoutUrl;
    }
  };

  const startLogin = async () => {
    setAuthError(null);
    try {
      await auth.startLogin();
    } catch (e) {
      setAuthError((e as Error).message);
    }
  };

  return (
    <div className="tokenbar">
      <div className="label">JWT (Authorization)</div>
      <div className="token-controls">
        <input
          className="input"
          placeholder="Paste JWT here"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="stack gap-s" style={{ alignItems: "flex-end" }}>
          <button className="btn ghost" onClick={save}>
            保存
          </button>
          <button className="btn ghost" onClick={logout}>
            ログアウト
          </button>
          <button className="btn" onClick={startLogin} disabled={!cognitoConfigured}>
            Cognitoでログイン
          </button>
        </div>
      </div>
      <div className="helper">
        認証済みJWTを貼り付けるか、Cognito Hosted UI でログインしてアクセストークンを取得します。
        {!cognitoConfigured && (
          <div style={{ color: "#b91c1c" }}>
            VITE_COGNITO_DOMAIN / VITE_COGNITO_CLIENT_ID が未設定です。
          </div>
        )}
        {authError && <div style={{ color: "#b91c1c" }}>{authError}</div>}
      </div>
    </div>
  );
};

export default TokenBar;
