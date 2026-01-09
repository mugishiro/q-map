import { useMemo } from "react";
import { auth } from "../auth";
import { useI18n } from "../i18n";

type Props = {
    onLogin: () => void;
    authError?: string | null;
    error?: string | null;
    loading?: boolean;
};

const LoginScreen = ({ onLogin, authError, error, loading = false }: Props) => {
    const { t } = useI18n();
    const isConfigured = useMemo(() => auth.isConfigured(), []);
    const errors = [authError, error].filter(Boolean) as string[];

    return (
        <div className="login-shell">
            <div className="login-demo" aria-hidden="true">
                <div className="login-demo-frame">
                    <div className="login-demo-topbar">
                        <span className="login-demo-dot" />
                        <span className="login-demo-dot" />
                        <span className="login-demo-dot" />
                        <div className="login-demo-title">QMap Live</div>
                    </div>
                    <div className="login-demo-body">
                        <div className="login-demo-chat">
                            <div className="demo-bubble demo-bubble-user">Create chat</div>
                            <div className="demo-bubble demo-bubble-bot">Selecting a node.</div>
                            <div className="demo-bubble demo-bubble-user">Branch next</div>
                        </div>
                        <div className="login-demo-graph">
                            <div className="demo-node demo-node-root">
                                <span>Start</span>
                            </div>
                            <div className="demo-node demo-node-focus">
                                <span>選択中</span>
                            </div>
                            <div className="demo-node demo-node-branch-a">
                                <span>A</span>
                            </div>
                            <div className="demo-node demo-node-branch-b">
                                <span>B</span>
                            </div>
                            <div className="demo-connector demo-connector-root" />
                            <div className="demo-connector demo-connector-left" />
                            <div className="demo-connector demo-connector-right" />
                        </div>
                    </div>
                </div>
            </div>
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
                        {loading ? t("auth.loggingIn") : t("auth.login")}
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
