import { useMemo, useState } from "react";
import { api } from "../api";
import { auth } from "../auth";

type Props = {
    onAuthChange: () => void;
    onLogout?: () => void;
};

const HeaderAuth = ({ onAuthChange, onLogout }: Props) => {
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
    };

    return (
        <div className="auth-controls stack gap-s">
            <div className="label">認証</div>
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
                            ログアウト
                        </button>
                    ) : (
                        <button
                            className="btn solid"
                            onClick={startLogin}
                            disabled={!isConfigured}
                        >
                            ログイン
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
