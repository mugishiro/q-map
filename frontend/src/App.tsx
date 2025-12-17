import { useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout";
import { TopicList } from "./components/TopicList";
import { TreeView } from "./components/TreeView";
import ChatPanel from "./components/ChatPanel";
import HeaderMenu from "./components/HeaderMenu";
import { api } from "./api";
import { auth } from "./auth";
import { Node, Topic } from "./types";
import { initTheme } from "./theme";

const buildPathLocal = (nodeId: string, nodes: Node[]): Node[] => {
  const map = new Map<string, Node>();
  nodes.forEach((n) => map.set(n.id, n));
  const chain: Node[] = [];
  let current: string | null = nodeId;
  while (current) {
    const node = map.get(current);
    if (!node) break;
    chain.push(node);
    current = node.parentIds?.[0] ?? node.parentId;
  }
  return chain.reverse();
};

const generateLocalLabel = (parentId: string | null, nodes: Node[]): string => {
  const map = new Map<string, Node>();
  nodes.forEach((n) => map.set(n.id, n));

  const depthFor = (id: string | null, depth = 0, seen = new Set<string>()): number => {
    if (!id) return depth;
    if (seen.has(id)) return depth;
    const node = map.get(id);
    if (!node || !node.parentId) return depth;
    seen.add(id);
    return depthFor(node.parentId, depth + 1, seen);
  };

  const depth = depthFor(parentId);
  const letter = String.fromCharCode(Math.min("A".charCodeAt(0) + depth, "Z".charCodeAt(0)));
  const siblings = nodes.filter((n) => n.parentId === parentId).length + 1;
  return `${letter}${siblings}`;
};

const stripLaterPrefix = (value?: string | null) => (value ? value.replace(/^あとで[:：]\s*/i, "") : value);
const isLaterNode = (node?: Node | null) => {
  if (!node) return false;
  const hasMessages = Array.isArray(node.messages) && node.messages.length > 0;
  return node.type === "later" || (!node.type && !hasMessages);
};

function App() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [path, setPath] = useState<Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [lastLaterNodeId, setLastLaterNodeId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [topicsCollapsed, setTopicsCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(Boolean(api.getToken()));
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSection, setMobileSection] = useState<"topics" | "tree" | "chat">("tree");

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    handler(mq);
    const listener = (e: MediaQueryListEvent) => handler(e);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const selectedTopicName = useMemo(
    () => topics.find((t) => t.id === selectedTopicId)?.name ?? "",
    [topics, selectedTopicId]
  );

  const refreshTopics = async () => {
    if (!authenticated) return;
    try {
      const res = await api.listTopics();
      setTopics(res.items.map((t) => ({ ...t, id: t.topicId ?? t.id } as any)));
      if (!selectedTopicId && res.items.length > 0) {
        setSelectedTopicId(res.items[0].topicId ?? res.items[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (authenticated) {
      refreshTopics();
    }
  }, [authenticated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code) return;

    const cleanupQuery = () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    };

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const tokens = await auth.exchangeCodeForToken(code, state ?? undefined);
        api.setToken(tokens.accessToken);
        setAuthenticated(true);
        await refreshTopics();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        cleanupQuery();
        setLoading(false);
      }
    };
    void run();
  }, []);

  const loadNodes = async (topicId: string, selectNodeId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listNodes(topicId, true);
      const mapped = res.items.map((n: any) => ({
        id: n.nodeId ?? n.id,
        ...n,
      }));
      const normalized = mapped.map((n) => {
        if (isLaterNode(n)) {
          return { ...n, type: "later", title: stripLaterPrefix(n.title), summary: stripLaterPrefix(n.summary) };
        }
        return n;
      });
      setNodes(normalized);
      const targetId = selectNodeId ?? selectedNodeId;
      if (targetId) {
        setPath(buildPathLocal(targetId, normalized));
        setSelectedNodeId(targetId);
        const selectedNode = normalized.find((n) => n.id === targetId);
        setLastLaterNodeId(isLaterNode(selectedNode) ? targetId : null);
      } else {
        setPath([]);
      }
      return normalized;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTopicId) void loadNodes(selectedTopicId);
  }, [selectedTopicId]);

  useEffect(() => {
    if (selectedNodeId) {
      const exists = nodes.find((n) => n.id === selectedNodeId);
      if (exists) {
        setPath(buildPathLocal(selectedNodeId, nodes));
        if (isLaterNode(exists)) {
          setLastLaterNodeId(selectedNodeId);
        }
      } else {
        setPath([]);
      }
    }
  }, [nodes, selectedNodeId]);

  const applyDraft = (text: string) => {
    const next = text.trim();
    if (!next) return;
    setChatDraft(next);
  };

  const handleDraftChange = (value: string) => {
    setChatDraft(value);
  };

  const handleSend = async ({ message, baseNodeId }: { message: string; baseNodeId?: string }) => {
    if (!selectedTopicId) return;
    const prevNodes = nodes;
    const prevPath = path;
    const activeFromSelection = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;
    const activeNodeFromPath = path[path.length - 1] ?? null;
    const activeNode = activeFromSelection ?? activeNodeFromPath;
    const activeNodeId = activeNode?.id ?? activeNodeFromPath?.id ?? selectedNodeId ?? null;
    const targetLaterNode =
      isLaterNode(activeFromSelection) && activeFromSelection
        ? activeFromSelection
        : isLaterNode(activeNodeFromPath) && activeNodeFromPath
        ? activeNodeFromPath
        : lastLaterNodeId
        ? nodes.find((n) => n.id === lastLaterNodeId) ?? null
        : null;
    if (targetLaterNode) {
      setLastLaterNodeId(null);
    }
    setLoading(true);
    setError(null);
    try {
      if (targetLaterNode) {
        const now = new Date().toISOString();
        const optimisticNode: Node = {
          ...targetLaterNode,
          title: message,
          summary: message,
          type: "chat",
          updatedAt: now,
          messages: [
            { role: "user", content: message, createdAt: now },
            { role: "assistant", content: "考え中…", createdAt: now, pending: true as any },
          ],
        };
        const optimisticList = nodes.map((n) => (n.id === targetLaterNode.id ? optimisticNode : n));
        setNodes(optimisticList);
        setPath(buildPathLocal(targetLaterNode.id, optimisticList));
        setSelectedNodeId(targetLaterNode.id);
        setChatDraft("");

        const res = await api.postChat({
          topicId: selectedTopicId,
          message,
          baseNodeId: targetLaterNode.parentId ?? undefined,
          nodeId: targetLaterNode.id,
        });
        const updatedId = res.node.nodeId ?? res.node.id ?? targetLaterNode.id;
        setSelectedNodeId(updatedId);
        await loadNodes(selectedTopicId, updatedId);
        return;
      }

      const targetBase = baseNodeId || activeNodeId || undefined;
      const now = new Date().toISOString();
      const tempId = `temp-${Date.now()}`;
      const optimisticLabel = generateLocalLabel(targetBase ?? null, nodes);
      const optimisticNode: Node = {
        id: tempId,
        label: optimisticLabel,
        topicId: selectedTopicId,
        parentId: targetBase ?? null,
        title: message,
        summary: message,
        type: "chat",
        createdAt: now,
        updatedAt: now,
        messages: [
          { role: "user", content: message, createdAt: now },
          { role: "assistant", content: "考え中…", createdAt: now, pending: true as any },
        ],
      };
      const optimisticList = [...nodes, optimisticNode];
      setNodes(optimisticList);
      setPath(buildPathLocal(tempId, optimisticList));
      setSelectedNodeId(tempId);
      setChatDraft("");

      const res = await api.postChat({ topicId: selectedTopicId, message, baseNodeId: targetBase });
      const newId = res.node.nodeId ?? res.node.id;
      setSelectedNodeId(newId);
      await loadNodes(selectedTopicId, newId);
    } catch (e) {
      setNodes(prevNodes);
      setPath(prevPath);
      setError((e as Error).message);
      setChatDraft(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLater = async ({ summary }: { summary: string }) => {
    const text = summary.trim();
    if (!text) return;
    if (!selectedTopicId) return;
    const clean = stripLaterPrefix(text);
    const prevNodes = nodes;
    const prevPath = path;
    const targetBase = selectedNodeId || path[path.length - 1]?.id || null;
    setLoading(true);
    setError(null);
    const now = new Date().toISOString();
    const tempId = `later-${Date.now()}`;
    const optimisticLabel = generateLocalLabel(targetBase, nodes);
    const optimisticNode: Node = {
      id: tempId,
      label: optimisticLabel,
      topicId: selectedTopicId ?? "",
      parentId: targetBase,
      title: clean,
      summary: clean,
      type: "later",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const optimisticList = [...nodes, optimisticNode];
    setNodes(optimisticList);
    setPath(buildPathLocal(tempId, optimisticList));
    setSelectedNodeId(tempId);
    setLastLaterNodeId(tempId);
    setChatDraft("");

    try {
      const res = await api.createLaterNode({
        topicId: selectedTopicId ?? "",
        parentId: targetBase,
        summary: clean,
        label: optimisticLabel,
      });
      await loadNodes(selectedTopicId ?? "", (res as any).nodeId ?? (res as any).id);
    } catch (e) {
      setNodes(prevNodes);
      setPath(prevPath);
      setError((e as Error).message);
      setChatDraft(clean);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTopic = async (id: string) => {
    setSelectedTopicId(id);
    setSelectedNodeId(null);
    setLastLaterNodeId(null);
    if (isMobile) setMobileSection("tree");
    await loadNodes(id);
  };

  const handleCreateTopic = async (name: string) => {
    await api.createTopic(name);
    await refreshTopics();
  };

  const handleManualToken = (token: string) => {
    api.setToken(token);
    setAuthenticated(true);
    void refreshTopics();
  };

  const handleLogout = () => {
    api.clearToken();
    auth.clearAuthArtifacts();
    setAuthenticated(false);
    setTopics([]);
    setNodes([]);
    setPath([]);
    setSelectedNodeId(null);
    setLastLaterNodeId(null);
    setChatDraft("");
  };

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setPath(buildPathLocal(nodeId, nodes));
    const target = nodes.find((n) => n.id === nodeId);
    if (target?.type === "later") {
      setLastLaterNodeId(nodeId);
      const text = stripLaterPrefix(target.title || target.summary || "");
      if (text) applyDraft(text);
    } else {
      setLastLaterNodeId(null);
    }
  };

  const handleLoginStart = async () => {
    setAuthError(null);
    try {
      await auth.startLogin();
    } catch (e) {
      setAuthError((e as Error).message);
    }
  };

  const left = (
    <div className="stack gap-s" style={{ height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="icon-btn"
          aria-label={topicsCollapsed ? "トピックを開く" : "トピックを畳む"}
          title={topicsCollapsed ? "トピックを開く" : "トピックを畳む"}
          onClick={() => setTopicsCollapsed((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d={topicsCollapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {!topicsCollapsed && (
        <TopicList
          topics={topics}
          selectedTopicId={selectedTopicId}
          onSelect={handleSelectTopic}
          onCreate={handleCreateTopic}
        />
      )}
    </div>
  );

  const activeNodeId = path[path.length - 1]?.id ?? null;

  const center = (
    <TreeView
      nodes={nodes}
      selectedNodeId={activeNodeId}
      onSelect={(nodeId) => {
        selectNode(nodeId);
        if (isMobile) setMobileSection("chat");
      }}
      mainRef="main"
      onPrefill={applyDraft}
    />
  );

  const right = (
    <div className="stack gap-m fill">
      <ChatPanel
        path={path}
        loading={loading}
        onSend={handleSend}
        onAddLater={handleLater}
        draft={chatDraft}
        onDraftChange={handleDraftChange}
        onPrefillDraft={applyDraft}
      />
      {error && <div className="card" style={{ color: "#b91c1c" }}>エラー: {error}</div>}
    </div>
  );

  const headerAction = (
    <HeaderMenu
      onAuthChange={refreshTopics}
      onLoginSuccess={() => setAuthenticated(true)}
      onLogout={handleLogout}
    />
  );

  if (!authenticated) {
    const manualToken = api.getToken() || "";
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="pill">Secure Access</div>
          <div className="brand hero">QMap</div>
          <div className="login-copy">
            思考の枝分かれを地図化するワークスペース。まずはログインして、トピック・ツリー・チャットにアクセスしてください。
          </div>
          <ul className="login-bullets">
            <li>GitHub Amplify ホスト + Cognito Hosted UI でサインイン</li>
            <li>JWT はブラウザにのみ保存され、リロードで自動再利用</li>
            <li>トークンがある場合は手動貼り付けも可能（デバッグ用）</li>
          </ul>
          <div className="login-actions">
            <button className="btn solid" onClick={handleLoginStart}>
              ログイン
            </button>
            <div className="manual-auth">
              <input
                className="input"
                style={{ width: "240px" }}
                placeholder="JWT を貼り付け（任意）"
                defaultValue={manualToken}
              />
              <button
                className="btn"
                onClick={() => {
                  const token = (document.querySelector(".manual-auth input") as HTMLInputElement | null)?.value;
                  if (token) handleManualToken(token.trim());
                }}
              >
                保存
              </button>
            </div>
          </div>
          <div className="helper-inline" style={{ marginTop: "8px" }}>
            Hosted UI に遷移しない場合は環境変数（VITE_COGNITO_*）をご確認ください。
          </div>
          {authError && <div className="helper-inline" style={{ color: "#b91c1c" }}>{authError}</div>}
          {error && <div className="helper-inline" style={{ color: "#b91c1c" }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <Layout
      left={left}
      center={center}
      right={right}
      headerAction={headerAction}
      leftCollapsed={topicsCollapsed}
      isMobile={isMobile}
      mobileSection={mobileSection}
      onMobileSectionChange={setMobileSection}
    />
  );
}

export default App;
