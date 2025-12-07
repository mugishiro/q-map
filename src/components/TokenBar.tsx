import { useState } from "react";
import { api } from "../api";

type Props = { onTokenSaved: () => void };

export const TokenBar = ({ onTokenSaved }: Props) => {
  const [token, setToken] = useState(api.getToken() || "");

  const save = () => {
    api.setToken(token.trim());
    onTokenSaved();
  };

  return (
    <div className="tokenbar">
      <div className="label">JWT (Authorization)</div>
      <div className="token-controls">
        <input
          className="input"
          placeholder="Paste JWT here"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button className="btn ghost" onClick={save}>
          保存
        </button>
      </div>
      <div className="helper">認証済みJWTを貼り付けてAPIを呼び出します。</div>
    </div>
  );
};

export default TokenBar;
