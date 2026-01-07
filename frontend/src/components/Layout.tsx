import { ReactNode } from "react";
import "../styles.css";

type Props = {
    left: ReactNode;
    center: ReactNode;
    right: ReactNode;
    headerAction?: ReactNode;
    leftCollapsed?: boolean;
    isMobile?: boolean;
    mobileSection?: "topics" | "tree" | "chat";
    mobileDrawer?: "topics" | "tree" | null;
    onMobileDrawerClose?: () => void;
};

export const Layout = ({
    left,
    center,
    right,
    headerAction,
    leftCollapsed = false,
    isMobile = false,
    mobileSection = "tree",
    mobileDrawer = null,
    onMobileDrawerClose,
}: Props) => {
    const drawerTitle =
        mobileDrawer === "topics"
            ? "履歴"
            : mobileDrawer === "tree"
              ? "ツリー"
              : "";
    const drawerContent =
        mobileDrawer === "topics"
            ? left
            : mobileDrawer === "tree"
              ? center
              : null;

    return (
        <div
            className="shell"
            data-mobile={isMobile}
            data-section={mobileSection}
        >
            <div className={`grid ${leftCollapsed ? "collapsed-left" : ""}`}>
                <header className="app-header topbar">
                    <div className="brand">QMap</div>
                    {headerAction && (
                        <div className="topbar-actions">{headerAction}</div>
                    )}
                </header>
                {!isMobile && (
                    <aside
                        className={`panel left ${leftCollapsed ? "collapsed" : ""}`}
                    >
                        {left}
                    </aside>
                )}
                {!isMobile && <main className="panel center">{center}</main>}
                <section className="panel right">{right}</section>
            </div>
            {isMobile && mobileDrawer && (
                <div
                    className={`mobile-drawer ${mobileDrawer ? "open" : ""}`}
                    data-drawer={mobileDrawer}
                >
                    <button
                        className="mobile-drawer-backdrop"
                        type="button"
                        aria-label="閉じる"
                        onClick={() => onMobileDrawerClose?.()}
                    />
                    <div className="mobile-drawer-panel" role="dialog">
                        <div className="mobile-drawer-header">
                            <span className="mobile-drawer-title">
                                {drawerTitle}
                            </span>
                            <button
                                className="icon-btn"
                                type="button"
                                aria-label="閉じる"
                                onClick={() => onMobileDrawerClose?.()}
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
                        <div className="mobile-drawer-body">
                            {drawerContent}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
