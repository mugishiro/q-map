import { useMemo } from "react";
import { auth } from "../auth";

type Props = {
    onLogin: () => void;
    authError?: string | null;
    error?: string | null;
    loading?: boolean;
};

const LoginScreen = ({ onLogin, authError, error, loading = false }: Props) => {
    const isConfigured = useMemo(() => auth.isConfigured(), []);
    const errors = [authError, error].filter(Boolean) as string[];

    return (
        <div className="login-shell">
            <div className="login-panel">
                <div className="login-card">
                    <div className="login-card-header">
                        <span className="login-pill">WELCOME</span>
                        <div className="login-brand">QMap</div>
                        <div className="login-subtitle">
                            思考を地図で整理するチャット
                        </div>
                        <div className="login-description">
                            ログイン後に LLM 設定で API キーを登録すると、
                            チャットが使えるようになります。
                        </div>
                        <ul className="login-list">
                            <li>ログインしてトピックを作成</li>
                            <li>ツリーで会話の流れを整理</li>
                            <li>「あとで」ノードで回収漏れを防止</li>
                        </ul>
                    </div>
                    <button
                        className="btn solid login-primary"
                        onClick={onLogin}
                        disabled={!isConfigured || loading}
                    >
                        {loading ? "認証中..." : "ログイン"}
                    </button>
                    <div className="login-hint">
                        LLM 設定はログイン後の「設定」から行えます。
                    </div>
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
