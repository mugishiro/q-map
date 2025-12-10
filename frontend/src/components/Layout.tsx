import { ReactNode } from "react";
import "../styles.css";

type Props = { left: ReactNode; center: ReactNode; right: ReactNode; headerAction?: ReactNode };

export const Layout = ({ left, center, right, headerAction }: Props) => {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">QMap</div>
        <div className="tagline">Branch your conversations. Compare every path.</div>
        {headerAction && <div className="topbar-actions">{headerAction}</div>}
      </header>
      <div className="grid">
        <aside className="panel left">{left}</aside>
        <main className="panel center">{center}</main>
        <section className="panel right">{right}</section>
      </div>
    </div>
  );
};

export default Layout;
