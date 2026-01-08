import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import SettingsPanel from "./SettingsPanel";
import {
    getStoredGrid,
    getStoredTheme,
    setGridVisible,
    setTheme,
    type ThemeOption,
} from "../theme";
import { useI18n } from "../i18n";

type Props = {
    onLogout: () => void;
    llmNeedsSetup?: boolean;
    onOpenLlm?: () => void;
    placement?: "up" | "down";
    align?: "left" | "right";
    showLabel?: boolean;
    label?: string;
};

export const HeaderMenu = ({
    onLogout,
    llmNeedsSetup = false,
    onOpenLlm,
    placement = "down",
    align = "left",
    showLabel = false,
    label,
}: Props) => {
    const { t, language, setLanguage } = useI18n();
    const labelText = label ?? t("header.settings");
    const [open, setOpen] = useState(false);
    const [showLlm, setShowLlm] = useState(false);
    const [theme, setThemeState] = useState<ThemeOption>(() =>
        getStoredTheme(),
    );
    const [grid, setGrid] = useState<boolean>(() => getStoredGrid());
    const menuRef = useRef<HTMLDivElement | null>(null);
    const loggedIn = Boolean(api.getToken());
    const themeLabel = theme === "dark" ? t("theme.dark") : t("theme.light");
    const gridLabel = grid ? t("grid.on") : t("grid.off");
    const applyTheme = (next: ThemeOption) => {
        setThemeState(next);
        setTheme(next);
    };
    const applyGrid = (next: boolean) => {
        setGrid(next);
        setGridVisible(next);
    };

    useEffect(() => {
        if (!open) return;
        setThemeState(getStoredTheme());
        setGrid(getStoredGrid());
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handleOutside = (event: MouseEvent | TouchEvent) => {
            if (!menuRef.current) return;
            if (menuRef.current.contains(event.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", handleOutside);
        document.addEventListener("touchstart", handleOutside);
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            document.removeEventListener("touchstart", handleOutside);
        };
    }, [open]);
    const popoverClass = `settings-popover card stack gap-m ${placement === "up" ? "popover-up" : ""} ${
        align === "right" ? "align-right" : "align-left"
    }`;
    return (
        <div className="settings-header" ref={menuRef}>
            <button
                className={`settings-trigger ${showLabel ? "with-label" : ""} ${
                    llmNeedsSetup ? "needs-attention" : ""
                }`}
                aria-label={labelText}
                title={labelText}
                onClick={() => setOpen((v) => !v)}
                type="button"
            >
                <span className="settings-trigger-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle
                            cx="12"
                            cy="12"
                            r="3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
                {llmNeedsSetup && (
                    <span className="settings-attention-dot" aria-hidden="true" />
                )}
                {showLabel && (
                    <span className="settings-trigger-label">{labelText}</span>
                )}
            </button>
            {open && (
                <div className={popoverClass}>
                    <div className="settings-popover-header">
                        <span className="settings-popover-title">
                            {t("header.settings")}
                        </span>
                        <button
                            className="icon-btn settings-popover-close"
                            aria-label={t("menu.close")}
                            title={t("menu.close")}
                            onClick={() => setOpen(false)}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <path
                                    d="M6 6l12 12M18 6L6 18"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="settings-menu">
                        <div
                            className="settings-menu-item has-submenu"
                            role="button"
                            tabIndex={0}
                        >
                            <span
                                className="settings-menu-icon"
                                aria-hidden="true"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M12 4v2m0 12v2m-8-8h2m12 0h2m-3.536-6.536-1.414 1.414M7.95 16.95l-1.414 1.414M7.05 6.464l1.414 1.414m7.072 7.072 1.414 1.414"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                            <span className="settings-menu-label">
                                {t("theme.label")}
                            </span>
                            <span className="settings-menu-trailing">
                                <span className="settings-menu-meta">
                                    {themeLabel}
                                </span>
                                <span className="settings-menu-arrow">›</span>
                            </span>
                            <div className="settings-submenu" role="menu">
                                <button
                                    className={`settings-submenu-item ${theme === "light" ? "active" : ""}`}
                                    onClick={() => applyTheme("light")}
                                    type="button"
                                >
                                    {t("theme.light")}
                                </button>
                                <button
                                    className={`settings-submenu-item ${theme === "dark" ? "active" : ""}`}
                                    onClick={() => applyTheme("dark")}
                                    type="button"
                                >
                                    {t("theme.dark")}
                                </button>
                            </div>
                        </div>
                        <div
                            className="settings-menu-item has-submenu"
                            role="button"
                            tabIndex={0}
                        >
                            <span
                                className="settings-menu-icon"
                                aria-hidden="true"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M5 5h4v4H5V5Zm0 10h4v4H5v-4Zm10-10h4v4h-4V5Zm0 10h4v4h-4v-4Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </span>
                            <span className="settings-menu-label">
                                {t("grid.label")}
                            </span>
                            <span className="settings-menu-trailing">
                                <span className="settings-menu-meta">
                                    {gridLabel}
                                </span>
                                <span className="settings-menu-arrow">›</span>
                            </span>
                            <div className="settings-submenu" role="menu">
                                <button
                                    className={`settings-submenu-item ${grid ? "active" : ""}`}
                                    onClick={() => applyGrid(true)}
                                    type="button"
                                >
                                    {t("grid.on")}
                                </button>
                                <button
                                    className={`settings-submenu-item ${!grid ? "active" : ""}`}
                                    onClick={() => applyGrid(false)}
                                    type="button"
                                >
                                    {t("grid.off")}
                                </button>
                            </div>
                        </div>
                        <div
                            className="settings-menu-item has-submenu"
                            role="button"
                            tabIndex={0}
                        >
                            <span
                                className="settings-menu-icon"
                                aria-hidden="true"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M12 3v18M3 12h18"
                                        stroke="currentColor"
                                        strokeWidth="1.4"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                            <span className="settings-menu-label">
                                {t("language.label")}
                            </span>
                            <span className="settings-menu-trailing">
                                <span className="settings-menu-meta">
                                    {language === "ja"
                                        ? t("language.ja")
                                        : t("language.en")}
                                </span>
                                <span className="settings-menu-arrow">›</span>
                            </span>
                            <div className="settings-submenu" role="menu">
                                <button
                                    className={`settings-submenu-item ${
                                        language === "ja" ? "active" : ""
                                    }`}
                                    onClick={() => setLanguage("ja")}
                                    type="button"
                                >
                                    {t("language.ja")}
                                </button>
                                <button
                                    className={`settings-submenu-item ${
                                        language === "en" ? "active" : ""
                                    }`}
                                    onClick={() => setLanguage("en")}
                                    type="button"
                                >
                                    {t("language.en")}
                                </button>
                            </div>
                        </div>
                        <button
                            className={`settings-menu-item ${llmNeedsSetup ? "attention" : ""}`}
                            onClick={() => {
                                setOpen(false);
                                if (onOpenLlm) {
                                    onOpenLlm();
                                    return;
                                }
                                setShowLlm(true);
                            }}
                            type="button"
                        >
                            <span
                                className="settings-menu-icon"
                                aria-hidden="true"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M6 7.5a4.5 4.5 0 0 1 4.5-4.5h6a4.5 4.5 0 0 1 0 9h-.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-1.22.57L11.5 13H10.5A4.5 4.5 0 0 1 6 8.5v-1Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </span>
                            <span className="settings-menu-label">
                                {t("menu.llm")}
                            </span>
                            <span className="settings-menu-trailing">
                                {llmNeedsSetup && (
                                    <span className="settings-menu-meta">
                                        {t("menu.unset")}
                                    </span>
                                )}
                                <span className="settings-menu-arrow">›</span>
                            </span>
                        </button>
                        {loggedIn && (
                            <button
                                className="settings-menu-item"
                                onClick={() => {
                                    onLogout();
                                    setOpen(false);
                                }}
                                type="button"
                            >
                                <span
                                    className="settings-menu-icon"
                                    aria-hidden="true"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                    >
                                        <path
                                            d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M14 8l4 4-4 4"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                        <path
                                            d="M9 12h9"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </span>
                                <span className="settings-menu-label">
                                    {t("menu.logout")}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            )}
            {showLlm && (
                <div
                    className="modal-backdrop"
                    onClick={() => setShowLlm(false)}
                >
                    <div
                        className="modal-card stack gap-m"
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: "min(360px, 90vw)" }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M6 7.5a4.5 4.5 0 0 1 4.5-4.5h6a4.5 4.5 0 0 1 0 9h-.75a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 1-1.22.57L11.5 13H10.5A4.5 4.5 0 0 1 6 8.5v-1Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <span style={{ fontWeight: 700 }}>
                                    {t("llm.label")}
                                </span>
                            </div>
                            <button
                                className="icon-btn"
                                aria-label={t("menu.close")}
                                title={t("menu.close")}
                                onClick={() => setShowLlm(false)}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M6 6l12 12M18 6L6 18"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </button>
                        </div>
                        <SettingsPanel
                            embedded
                            noCard
                            showCloseButton={false}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeaderMenu;
