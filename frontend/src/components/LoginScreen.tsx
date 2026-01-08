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
                        <div className="login-brand">QMap</div>
                    </div>
                    <button
                        className="btn solid login-primary"
                        onClick={onLogin}
                        disabled={!isConfigured || loading}
                    >
                        {loading ? "認証中..." : "ログイン"}
                    </button>
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
