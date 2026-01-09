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
                    </div>
                    <div className="login-demo-body">
                        <div className="login-demo-map">
                            <div className="demo-map-grid" />
                            <div className="demo-node demo-node-root">
                                <span className="demo-node-dot" />
                            </div>
                            <div className="demo-node demo-node-child">
                                <span className="demo-node-dot" />
                            </div>
                            <div className="demo-node demo-node-branch">
                                <span className="demo-node-dot" />
                            </div>
                            <div className="demo-connector demo-connector-main" />
                            <div className="demo-connector demo-connector-branch" />
                        </div>
                        <div className="login-demo-chat">
                            <div className="demo-bubble demo-bubble-user">
                                <span className="demo-dots">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </div>
                            <div className="demo-bubble demo-bubble-bot">
                                <span className="demo-dots">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </div>
                            <div className="demo-bubble demo-bubble-user">
                                <span className="demo-dots">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </div>
                            <div className="demo-input">
                                <span className="demo-input-line" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="login-panel">
                <div className="login-card">
                    <div className="login-card-header">
                        <div className="login-brand">QMap</div>
                    </div>
                    <div className="login-intro">
                        <div className="login-intro-title">チャット履歴を可視化する</div>
                        <div className="login-intro-body">
                            対話をするとノードが追加されます。
                            過去のノードから対話をやり直すと、対話履歴が分岐していきます。
                        </div>
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
