import { useMemo, useState, type FormEvent } from "react";
import { auth } from "../auth";

type Props = {
  onLogin: () => void;
  onManualToken: (token: string) => void;
  authError?: string | null;
  error?: string | null;
  loading?: boolean;
  initialToken?: string;
};

const LoginScreen = ({
  onLogin,
  onManualToken,
  authError,
  error,
  loading = false,
  initialToken = "",
}: Props) => {
  const [manualToken, setManualToken] = useState(initialToken);
  const [manualOpen, setManualOpen] = useState(false);
  const config = useMemo(() => auth.getConfig(), []);
  const isConfigured = Boolean(config);
  const errors = [authError, error].filter(Boolean) as string[];

  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = manualToken.trim();
    if (!trimmed) return;
    onManualToken(trimmed);
  };

  return (
    <div className="login-shell">
      <div className="login-visual">
        <div className="login-orb orb-1" aria-hidden="true" />
        <div className="login-orb orb-2" aria-hidden="true" />
        <div className="login-orb orb-3" aria-hidden="true" />
        <div className="login-hero">
          <div className="login-pill">Cognito PKCE</div>
          <div className="login-title">QMap</div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-brand">QMap</div>
            <div className="login-subtitle">ログイン</div>
          </div>
          <button className="btn solid login-primary" onClick={onLogin} disabled={!isConfigured || loading}>
            {loading ? "認証中..." : "Cognitoでログイン"}
          </button>
          {!isConfigured && <div className="login-warning">Cognito未設定です。</div>}
          <div className="login-divider">
            <span>または</span>
          </div>
          <button className="btn ghost login-secondary" onClick={() => setManualOpen((v) => !v)}>
            {manualOpen ? "JWT入力を閉じる" : "JWTでログイン"}
          </button>
          {manualOpen && (
            <form className="login-manual" onSubmit={handleManualSubmit}>
              <label className="login-label" htmlFor="manual-jwt">
                JWT
              </label>
              <div className="login-manual-row">
                <input
                  id="manual-jwt"
                  className="input"
                  placeholder="アクセストークン"
                  value={manualToken}
                  onChange={(event) => setManualToken(event.target.value)}
                />
                <button className="btn" type="submit">
                  適用
                </button>
              </div>
            </form>
          )}
          {errors.length > 0 && (
            <div className="login-error">
              {errors.map((message, index) => (
                <div key={`${message}-${index}`}>{message}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
