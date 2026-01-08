import { useMemo, useState } from "react";
import { api } from "../api";
import { auth } from "../auth";
import { useI18n } from "../i18n";

type Props = { onTokenSaved: () => void };

export const TokenBar = ({ onTokenSaved }: Props) => {
  const { t } = useI18n();
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
            {t("token.save")}
          </button>
          <button className="btn ghost" onClick={logout}>
            {t("token.logout")}
          </button>
          <button className="btn" onClick={startLogin} disabled={!cognitoConfigured}>
            {t("token.login")}
          </button>
        </div>
      </div>
      <div className="helper">
        {t("token.helper")}
        {!cognitoConfigured && (
          <div style={{ color: "#b91c1c" }}>
            {t("token.missingConfig")}
          </div>
        )}
        {authError && <div style={{ color: "#b91c1c" }}>{authError}</div>}
      </div>
    </div>
  );
};

export default TokenBar;
