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
  onMobileSectionChange?: (section: "topics" | "tree" | "chat") => void;
};

export const Layout = ({
  left,
  center,
  right,
  headerAction,
  leftCollapsed = false,
  isMobile = false,
  mobileSection = "tree",
  onMobileSectionChange,
}: Props) => {
  return (
    <div className="shell" data-mobile={isMobile} data-section={mobileSection}>
      <header className="topbar">
        <div className="brand">QMap</div>
        {headerAction && <div className="topbar-actions">{headerAction}</div>}
      </header>
      {isMobile && (
        <div className="mobile-nav">
          <button
            className={`mobile-tab ${mobileSection === "topics" ? "active" : ""}`}
            onClick={() => onMobileSectionChange?.("topics")}
          >
            トピック
          </button>
          <button
            className={`mobile-tab ${mobileSection === "tree" ? "active" : ""}`}
            onClick={() => onMobileSectionChange?.("tree")}
          >
            ツリー
          </button>
          <button
            className={`mobile-tab ${mobileSection === "chat" ? "active" : ""}`}
            onClick={() => onMobileSectionChange?.("chat")}
          >
            チャット
          </button>
        </div>
      )}
      <div className={`grid ${leftCollapsed ? "collapsed-left" : ""}`}>
        <aside className={`panel left ${leftCollapsed ? "collapsed" : ""}`}>{left}</aside>
        <main className="panel center">{center}</main>
        <section className="panel right">{right}</section>
      </div>
    </div>
  );
};

export default Layout;
