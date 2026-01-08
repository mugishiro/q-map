import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ja" | "en";

const STORAGE_KEY = "qmap_lang";

const translations: Record<Language, Record<string, string>> = {
  ja: {
    "app.brand": "QMap",
    "app.errorPrefix": "エラー",
    "auth.label": "認証",
    "auth.login": "ログイン",
    "auth.logout": "ログアウト",
    "action.delete": "削除",
    "auth.loggingIn": "認証中...",
    "banner.llmTitle": "LLM 設定が未完了です",
    "banner.llmBody": "APIキーを登録するとチャットが有効になります。",
    "banner.llmOpen": "LLM 設定を開く",
    "banner.llmHint": "設定は右上の「設定」からも開けます。",
    "chat.askLater": "あとで聞く",
    "chat.ask": "聞く",
    "chat.askLaterAdd": "あとで聞くに追加",
    "chat.empty": "会話がありません",
    "chat.pending": "考え中…",
    "chat.selectionActions": "選択テキスト操作",
    "chat.send": "送信",
    "chat.thinking": "考え中…",
    "chat.placeholder": "わからないことをAIに質問する",
    "drawer.history": "履歴",
    "drawer.tree": "ツリー",
    "drawer.close": "閉じる",
    "grid.on": "On",
    "grid.off": "Off",
    "grid.label": "グリッド",
    "header.settings": "設定",
    "language.label": "言語",
    "language.ja": "日本語",
    "language.en": "English",
    "later.label": "後で聞く",
    "later.count": "{count} 件",
    "later.empty": "登録なし",
    "later.savedQuestion": "保存済みの質問",
    "layout.sidebarOpen": "サイドバーを開く",
    "layout.sidebarClose": "サイドバーを畳む",
    "layout.newChat": "新しいチャット",
    "llm.label": "LLM 設定",
    "llm.unset": "未設定",
    "llm.saved": "保存済み: {value}",
    "llm.provider": "プロバイダ",
    "llm.model": "モデル",
    "llm.apiKey": "API キー",
    "llm.save": "保存",
    "llm.close": "閉じる",
    "llm.exampleModel": "例: gpt-4o-mini",
    "llm.show": "表示",
    "llm.hide": "隠す",
    "llm.open": "設定を開く",
    "llm.openHeader": "設定を閉じる",
    "llm.helper": "プロバイダ/モデル/APIキーを設定してチャットを有効化します。",
    "llm.savedNone": "なし",
    "llm.noticeSaved": "保存しました。チャット送信にこのキーが使われます。",
    "menu.close": "閉じる",
    "menu.theme": "テーマ",
    "menu.logout": "ログアウト",
    "menu.llm": "LLM 設定",
    "menu.unset": "未設定",
    "node.fallback": "ノード",
    "node.noTitle": "（無題）",
    "settings.open": "LLM 設定",
    "settings.openClose": "設定を閉じる",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.label": "テーマ",
    "token.save": "保存",
    "token.logout": "ログアウト",
    "token.login": "Cognitoでログイン",
    "token.helper":
      "認証済みJWTを貼り付けるか、Cognito Hosted UI でログインしてアクセストークンを取得します。",
    "token.missingConfig": "VITE_COGNITO_DOMAIN / VITE_COGNITO_CLIENT_ID が未設定です。",
    "topic.empty": "チャットがありません",
    "tree.empty": "ノードなし",
    "tree.listToggle": "ノード一覧を切り替える",
    "tree.listOpen": "一覧を開く",
    "tree.listClose": "一覧を閉じる",
    "tree.scroll": "横スクロール",
    "tree.scrollLeft": "左にスクロール",
    "tree.scrollRight": "右にスクロール",
    "path.label": "パス",
    "path.empty": "ノードを選択してください",
    "later.disallowUnderLater": "「あとで聞く」の下には追加できません。",
  },
  en: {
    "app.brand": "QMap",
    "app.errorPrefix": "Error",
    "auth.label": "Auth",
    "auth.login": "Sign in",
    "auth.logout": "Sign out",
    "action.delete": "Delete",
    "auth.loggingIn": "Signing in...",
    "banner.llmTitle": "LLM setup is incomplete",
    "banner.llmBody": "Register an API key to enable chat.",
    "banner.llmOpen": "Open LLM settings",
    "banner.llmHint": "You can also open it from Settings.",
    "chat.askLater": "Ask later",
    "chat.ask": "Ask",
    "chat.askLaterAdd": "Add to Ask later",
    "chat.empty": "No conversation yet",
    "chat.pending": "Thinking...",
    "chat.selectionActions": "Selection actions",
    "chat.send": "Send",
    "chat.thinking": "Thinking...",
    "chat.placeholder": "Ask the AI what you want to know",
    "drawer.history": "History",
    "drawer.tree": "Tree",
    "drawer.close": "Close",
    "grid.on": "On",
    "grid.off": "Off",
    "grid.label": "Grid",
    "header.settings": "Settings",
    "language.label": "Language",
    "language.ja": "Japanese",
    "language.en": "English",
    "later.label": "Ask later",
    "later.count": "{count} items",
    "later.empty": "None",
    "later.savedQuestion": "Saved question",
    "layout.sidebarOpen": "Open sidebar",
    "layout.sidebarClose": "Collapse sidebar",
    "layout.newChat": "New chat",
    "llm.label": "LLM settings",
    "llm.unset": "Not set",
    "llm.saved": "Saved: {value}",
    "llm.provider": "Provider",
    "llm.model": "Model",
    "llm.apiKey": "API key",
    "llm.save": "Save",
    "llm.close": "Close",
    "llm.exampleModel": "e.g. gpt-4o-mini",
    "llm.show": "Show",
    "llm.hide": "Hide",
    "llm.open": "Open settings",
    "llm.openHeader": "Close settings",
    "llm.helper": "Set provider/model/API key to enable chat.",
    "llm.savedNone": "None",
    "llm.noticeSaved": "Saved. This key will be used for chat.",
    "menu.close": "Close",
    "menu.theme": "Theme",
    "menu.logout": "Sign out",
    "menu.llm": "LLM settings",
    "menu.unset": "Not set",
    "node.fallback": "node",
    "node.noTitle": "(no title)",
    "settings.open": "LLM settings",
    "settings.openClose": "Close settings",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.label": "Theme",
    "token.save": "Save",
    "token.logout": "Sign out",
    "token.login": "Sign in with Cognito",
    "token.helper": "Paste a JWT or sign in via Cognito Hosted UI to get an access token.",
    "token.missingConfig": "VITE_COGNITO_DOMAIN / VITE_COGNITO_CLIENT_ID is not configured.",
    "topic.empty": "No chats yet",
    "tree.empty": "No nodes",
    "tree.listToggle": "Toggle node list",
    "tree.listOpen": "Open list",
    "tree.listClose": "Close list",
    "tree.scroll": "Horizontal scroll",
    "tree.scrollLeft": "Scroll left",
    "tree.scrollRight": "Scroll right",
    "path.label": "Path",
    "path.empty": "Select a node",
    "later.disallowUnderLater": "You cannot add under an Ask later node.",
  },
};

const format = (template: string, params?: Record<string, string | number>) => {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  );
};

const getInitialLanguage = (): Language => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ja" || stored === "en") return stored;
  return "ja";
};

type I18nContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    return {
      language,
      setLanguage,
      t: (key, params) => {
        const dict = translations[language];
        const template = dict[key] ?? translations.ja[key] ?? key;
        return format(template, params);
      },
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    language: "ja" as Language,
    setLanguage: () => {},
    t: (key: string, params?: Record<string, string | number>) => {
      const template = translations.ja[key] ?? key;
      return format(template, params);
    },
  };
};
