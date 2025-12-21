import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { UserSettings } from "../types";

const mask = (value: string | null) => {
  if (!value) return null;
  if (value.length <= 6) return "******";
  return `${value.slice(0, 4)}****${value.slice(-2)}`;
};

const providers = [
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
] as const;

type Props = {
  variant?: "panel" | "header";
  embedded?: boolean;
  hideTheme?: boolean;
  showCloseButton?: boolean;
  noCard?: boolean;
};

const SettingsPanel = ({ variant = "panel", embedded = false, showCloseButton = true, noCard = false }: Props) => {
  const isHeader = variant === "header";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState<{ llmProvider: string; model: string; apiKey: string }>({
    llmProvider: "openai",
    model: "gpt-4o-mini",
    apiKey: "",
  });
  const [currentMasked, setCurrentMasked] = useState<string | null>(null);
  const providerOptions = useMemo(() => providers.map((p) => p.value), []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res: UserSettings = await api.getSettings();
      setForm((f) => ({
        ...f,
        llmProvider: res.llmProvider || f.llmProvider,
        model: res.model || f.model,
        apiKey: "",
      }));
      setCurrentMasked(res.apiKeyMasked || null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open || embedded) void loadSettings();
  }, [open, embedded]);

  const save = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await api.saveSettings({
        llmProvider: form.llmProvider,
        model: form.model,
        apiKey: form.apiKey,
      });
      setCurrentMasked(mask(form.apiKey) || currentMasked);
      setNotice("保存しました。チャット送信にこのキーが使われます。");
      setForm((f) => ({ ...f, apiKey: "" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const llmSection = (
    <div className="settings-panel">
      <div className="settings-section-header">
        <span className="label">LLM 設定</span>
        {currentMasked && <span className="settings-chip">保存済み: {currentMasked}</span>}
      </div>
      <div className="settings-fields">
        <label className="settings-field">
          <span className="settings-field-label">Provider</span>
          <select
            className="input"
            value={form.llmProvider}
            onChange={(e) => setForm((f) => ({ ...f, llmProvider: e.target.value }))}
          >
            {providerOptions.map((p) => (
              <option key={p} value={p}>
                {providers.find((v) => v.value === p)?.label ?? p}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Model</span>
          <input
            className="input"
            placeholder="例: gpt-4o-mini"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">API Key</span>
          <div className="settings-inline">
            <input
              className="input"
              placeholder="sk-..."
              type={showApiKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            />
            <button className="btn ghost" onClick={() => setShowApiKey((v) => !v)}>
              {showApiKey ? "隠す" : "表示"}
            </button>
          </div>
          <span className="settings-hint">保存時に暗号化され、クライアントへは返しません。</span>
        </label>
      </div>
      <div className="settings-actions">
        <button className="btn solid" onClick={save} disabled={loading}>
          保存
        </button>
        {showCloseButton && (
          <button className="btn ghost" onClick={() => setOpen(false)} disabled={loading}>
            閉じる
          </button>
        )}
      </div>
      {notice && <div className="settings-message success">{notice}</div>}
      {error && <div className="settings-message error">{error}</div>}
    </div>
  );

  const formContent = <div className="stack gap-m">{llmSection}</div>;

  if (embedded) {
    return noCard ? <div>{formContent}</div> : <div className="card">{formContent}</div>;
  }

  if (isHeader) {
    return (
      <div className="settings-header">
        <button className="btn ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "設定を閉じる" : "LLM 設定"}
        </button>
        {open && <div className="settings-popover card">{formContent}</div>}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="card">
        <div className="stack gap-xs">
          <div className="label">LLM 設定</div>
          <div>プロバイダ/モデル/APIキーを設定してチャットを有効化します。</div>
          <div className="helper-inline">保存済み: {currentMasked || "なし"}</div>
          <button className="btn solid" onClick={() => setOpen(true)}>
            設定を開く
          </button>
        </div>
      </div>
    );
  }

  return <div className="card">{formContent}</div>;
};

export default SettingsPanel;
