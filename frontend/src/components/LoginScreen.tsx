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
  const domainLabel = config?.domain?.replace(/^https?:\/\//, "") ?? "";

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
          <div className="login-pill">Cognito OAuth · Authorization Code + PKCE</div>
          <div className="login-title">QMap</div>
          <div className="login-tagline">会話を地図にして、知識の流れを立体的に捉える。</div>
          <div className="login-feature-grid">
            <div className="login-feature">
              <div className="login-feature-title">構造化チャット</div>
              <div className="login-feature-copy">対話をツリーで整理し、思考の枝分かれを管理。</div>
            </div>
            <div className="login-feature">
              <div className="login-feature-title">あとで聞く</div>
              <div className="login-feature-copy">会話を止めずに次の質問をキューに追加。</div>
            </div>
            <div className="login-feature">
              <div className="login-feature-title">セキュア認証</div>
              <div className="login-feature-copy">Cognito の PKCE フローで安全にログイン。</div>
            </div>
          </div>
          <div className={`login-status ${isConfigured ? "ready" : "missing"}`}>
            <span className="status-dot" aria-hidden="true" />
            <div>
              <div className="login-status-title">
                {isConfigured ? "Cognito 接続が有効です" : "Cognito が未設定です"}
              </div>
              <div className="login-status-meta">
                {isConfigured
                  ? `${domainLabel} · ${config?.redirectUri ?? ""}`
                  : "VITE_COGNITO_DOMAIN / VITE_COGNITO_CLIENT_ID を設定してください。"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-brand">QMap</div>
            <div className="login-subtitle">ログインして開始</div>
            <div className="login-caption">Cognito Hosted UI に遷移します。</div>
          </div>
          <button className="btn solid login-primary" onClick={onLogin} disabled={!isConfigured || loading}>
            {loading ? "認証中..." : "Cognitoでログイン"}
          </button>
          {!isConfigured && <div className="login-warning">環境変数を設定すると有効化できます。</div>}
          <div className="login-divider">
            <span>または</span>
          </div>
          <button className="btn ghost login-secondary" onClick={() => setManualOpen((v) => !v)}>
            {manualOpen ? "トークン入力を閉じる" : "JWTでログイン"}
          </button>
          {manualOpen && (
            <form className="login-manual" onSubmit={handleManualSubmit}>
              <label className="login-label" htmlFor="manual-jwt">
                JWT を貼り付け
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
              <div className="login-helper">開発用のトークンログインです。</div>
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
        <div className="login-footer">
          クラウドの安全な認証で、あなたの会話をすぐに同期します。
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
