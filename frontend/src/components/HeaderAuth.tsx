import { useMemo, useState } from "react";
import { api } from "../api";
import { auth } from "../auth";
import { useI18n } from "../i18n";

type Props = {
    onAuthChange: () => void;
    onLogout?: () => void;
};

const HeaderAuth = ({ onAuthChange, onLogout }: Props) => {
    const { t } = useI18n();
    const [error, setError] = useState<string | null>(null);

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
        onAuthChange();
        onLogout?.();
        const logoutUrl = auth.getLogoutUrl();
        if (logoutUrl) {
            window.location.href = logoutUrl;
        }
    };

    return (
            <div className="auth-controls stack gap-s">
            <div className="label">{t("auth.label")}</div>
            <div className="stack gap-xs">
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {loggedIn ? (
                        <button
                            className="btn ghost"
                            onClick={logout}
                            style={{
                                borderColor: "#e11d48",
                                color: "#e11d48",
                                background: "transparent",
                            }}
                        >
                            {t("auth.logout")}
                        </button>
                    ) : (
                        <button
                            className="btn solid"
                            onClick={startLogin}
                            disabled={!isConfigured}
                        >
                            {t("auth.login")}
                        </button>
                    )}
                </div>
            </div>
            {error && (
                <span style={{ color: "#b91c1c", fontSize: "12px" }}>
                    {error}
                </span>
            )}
        </div>
    );
};

export default HeaderAuth;
