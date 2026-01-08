import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { UserSettings } from "../types";
import { useI18n } from "../i18n";

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
  onSaved?: () => void;
};

const SettingsPanel = ({
  variant = "panel",
  embedded = false,
  showCloseButton = true,
  noCard = false,
  onSaved,
}: Props) => {
  const { t } = useI18n();
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
      setNotice(t("llm.noticeSaved"));
      setForm((f) => ({ ...f, apiKey: "" }));
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const llmSection = (
    <div className="settings-panel">
      <div className="settings-section-header">
        <span className="label">{t("llm.label")}</span>
        {currentMasked && (
          <span className="settings-chip">
            {t("llm.saved", { value: currentMasked })}
          </span>
        )}
      </div>
      <div className="settings-fields">
        <label className="settings-field">
          <span className="settings-field-label">{t("llm.provider")}</span>
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
          <span className="settings-field-label">{t("llm.model")}</span>
          <input
            className="input"
            placeholder={t("llm.exampleModel")}
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">{t("llm.apiKey")}</span>
          <div className="settings-inline">
            <input
              className="input"
              placeholder="sk-..."
              type={showApiKey ? "text" : "password"}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            />
            <button className="btn ghost" onClick={() => setShowApiKey((v) => !v)}>
              {showApiKey ? t("llm.hide") : t("llm.show")}
            </button>
          </div>
        </label>
      </div>
      <div className="settings-actions">
        <button className="btn solid" onClick={save} disabled={loading}>
          {t("llm.save")}
        </button>
        {showCloseButton && (
          <button className="btn ghost" onClick={() => setOpen(false)} disabled={loading}>
            {t("llm.close")}
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
          {open ? t("settings.openClose") : t("settings.open")}
        </button>
        {open && <div className="settings-popover card">{formContent}</div>}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="card">
        <div className="stack gap-xs">
          <div className="label">{t("llm.label")}</div>
          <div>{t("llm.helper")}</div>
          <div className="helper-inline">
            {t("llm.saved", { value: currentMasked || t("llm.savedNone") })}
          </div>
          <button className="btn solid" onClick={() => setOpen(true)}>
            {t("llm.open")}
          </button>
        </div>
      </div>
    );
  }

  return <div className="card">{formContent}</div>;
};

export default SettingsPanel;
