import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout";
import { TopicList } from "./components/TopicList";
import { TreeView } from "./components/TreeView";
import ChatPanel from "./components/ChatPanel";
import HeaderMenu from "./components/HeaderMenu";
import LoginScreen from "./components/LoginScreen";
import SettingsPanel from "./components/SettingsPanel";
import { api } from "./api";
import { auth } from "./auth";
import { Node, Topic } from "./types";
import { initTheme } from "./theme";

const LLM_PROMPT_KEY = "qmap_llm_prompted_v1";

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

    const depthFor = (
        id: string | null,
        depth = 0,
        seen = new Set<string>(),
    ): number => {
        if (!id) return depth;
        if (seen.has(id)) return depth;
        const node = map.get(id);
        if (!node || !node.parentId) return depth;
        seen.add(id);
        return depthFor(node.parentId, depth + 1, seen);
    };

    const depth = depthFor(parentId);
    const letter = String.fromCharCode(
        Math.min("A".charCodeAt(0) + depth, "Z".charCodeAt(0)),
    );
    const siblings = nodes.filter((n) => n.parentId === parentId).length + 1;
    return `${letter}${siblings}`;
};

const LEGACY_DEFAULT_TITLE = "New chat";
const MAX_CHAT_TITLE_LENGTH = 48;
const buildChatTitleFromMessage = (message: string) => {
    const firstLine =
        message.split(/\r?\n/).find((line) => line.trim()) ?? message;
    const compact = firstLine.trim().replace(/\s+/g, " ");
    if (compact.length <= MAX_CHAT_TITLE_LENGTH) return compact;
    return `${compact.slice(0, MAX_CHAT_TITLE_LENGTH - 3)}...`;
};

const stripLaterPrefix = (value?: string | null) =>
    value ? value.replace(/^あとで[:：]\s*/i, "") : value;
const getParentId = (node: Node) =>
    node.parentId ?? node.parentIds?.[0] ?? null;
const isLaterNode = (node?: Node | null) => {
    if (!node) return false;
    if (node.type === "later") return true;
    return false;
};

function App() {
    const [topics, setTopics] = useState<Topic[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [pendingNewChat, setPendingNewChat] = useState(false);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [path, setPath] = useState<Node[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [lastLaterNodeId, setLastLaterNodeId] = useState<string | null>(null);
    const [chatDraft, setChatDraft] = useState("");
    const [topicsCollapsed, setTopicsCollapsed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authenticated, setAuthenticated] = useState<boolean>(
        Boolean(api.getToken()),
    );
    const [authError, setAuthError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
    const [llmChecking, setLlmChecking] = useState(false);
    const [showLlmModal, setShowLlmModal] = useState(false);
    const [mobileSection, setMobileSection] = useState<
        "topics" | "tree" | "chat"
    >("chat");
    const [mobileDrawer, setMobileDrawer] = useState<"topics" | "tree" | null>(
        null,
    );
    const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        initTheme();
    }, []);

    useEffect(() => {
        const update = () => {
            setIsMobile(window.innerWidth <= 900);
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("orientationchange", update);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("orientationchange", update);
        };
    }, []);

    useEffect(() => {
        if (isMobile) {
            setMobileSection("chat");
            return;
        }
        setMobileDrawer(null);
        setMobileSection("tree");
    }, [isMobile]);

    const toggleMobileDrawer = (next: "topics" | "tree") => {
        setMobileDrawer((current) => (current === next ? null : next));
    };

    const refreshTopics = async (preferredId?: string | null) => {
        if (!authenticated) return;
        try {
            const res = await api.listTopics();
            const normalized = res.items.map(
                (t) => ({ ...t, id: (t as any).topicId ?? t.id }) as any,
            );
            setTopics(normalized);
            if (preferredId) {
                setSelectedTopicId(preferredId);
                return;
            }
            if (!selectedTopicId && normalized.length > 0 && !pendingNewChat) {
                setSelectedTopicId(normalized[0].id);
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

    const refreshLlmSettings = async () => {
        if (!authenticated) return;
        setLlmChecking(true);
        try {
            const res = await api.getSettings();
            setLlmConfigured(Boolean(res.apiKeyMasked));
        } catch {
            setLlmConfigured(false);
        } finally {
            setLlmChecking(false);
        }
    };

    useEffect(() => {
        if (!authenticated) {
            setLlmConfigured(null);
            return;
        }
        void refreshLlmSettings();
    }, [authenticated]);

    useEffect(() => {
        if (!authenticated) return;
        if (llmConfigured !== false) return;
        const prompted = localStorage.getItem(LLM_PROMPT_KEY);
        if (prompted) return;
        setShowLlmModal(true);
        localStorage.setItem(LLM_PROMPT_KEY, "1");
    }, [authenticated, llmConfigured]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        const oauthError = params.get("error");
        const oauthErrorDescription = params.get("error_description");
        if (!code && !oauthError) return;

        const cleanupQuery = () => {
            window.history.replaceState(
                {},
                document.title,
                window.location.pathname,
            );
        };

        if (oauthError) {
            auth.clearAuthArtifacts();
            setAuthError(
                oauthErrorDescription
                    ? `${oauthError}: ${oauthErrorDescription}`
                    : oauthError,
            );
            cleanupQuery();
            return;
        }

        const run = async () => {
            setLoading(true);
            setError(null);
            setAuthError(null);
            try {
                const tokens = await auth.exchangeCodeForToken(
                    code,
                    state ?? undefined,
                );
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
            const normalized = res.items.map((n) => {
                if (isLaterNode(n)) {
                    return {
                        ...n,
                        type: "later",
                        title: stripLaterPrefix(n.title),
                        summary: stripLaterPrefix(n.summary),
                    };
                }
                return n;
            });
            setNodes(normalized);
            const targetId =
                selectNodeId ?? selectedNodeId ?? normalized[0]?.id ?? null;
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

    const applyLaterDraft = (text: string) => {
        const clean = stripLaterPrefix(text);
        if (clean) applyDraft(clean);
    };

    const handleDraftChange = (value: string) => {
        setChatDraft(value);
    };

    const handleSend = async ({
        message,
        baseNodeId,
    }: {
        message: string;
        baseNodeId?: string;
    }) => {
        const prevNodes = nodes;
        const prevPath = path;
        const prevTopics = topics;
        const prevSelectedTopicId = selectedTopicId;
        const prevPendingNewChat = pendingNewChat;
        let topicId = selectedTopicId;
        let createdTopicId: string | null = null;
        const activeFromSelection = selectedNodeId
            ? (nodes.find((n) => n.id === selectedNodeId) ?? null)
            : null;
        const activeNodeFromPath = path[path.length - 1] ?? null;
        const activeNode = activeFromSelection ?? activeNodeFromPath;
        const activeNodeId =
            activeNode?.id ?? activeNodeFromPath?.id ?? selectedNodeId ?? null;
        const targetLaterNode =
            isLaterNode(activeFromSelection) && activeFromSelection
                ? activeFromSelection
                : isLaterNode(activeNodeFromPath) && activeNodeFromPath
                  ? activeNodeFromPath
                  : lastLaterNodeId
                    ? (nodes.find((n) => n.id === lastLaterNodeId) ?? null)
                    : null;
        if (targetLaterNode) {
            setLastLaterNodeId(null);
        }
        setLoading(true);
        setError(null);
        try {
            if (!topicId) {
                const title = buildChatTitleFromMessage(message);
                const created = await api.createTopic(title);
                const nextId = (created as any).topicId ?? created.id ?? null;
                if (!nextId) throw new Error("TOPIC_CREATE_FAILED");
                const normalized = { ...created, id: nextId } as Topic;
                createdTopicId = nextId;
                topicId = nextId;
                setTopics((prev) => [
                    normalized,
                    ...prev.filter((t) => t.id !== nextId),
                ]);
                setSelectedTopicId(nextId);
                setPendingNewChat(false);
            }
            if (!topicId) throw new Error("TOPIC_NOT_READY");

            const maybeUpdateTitle = async () => {
                if (!topicId) return;
                const topic = topics.find((t) => t.id === topicId);
                if (!topic || topic.name !== LEGACY_DEFAULT_TITLE) return;
                const nextTitle = buildChatTitleFromMessage(message);
                if (!nextTitle) return;
                try {
                    const updated = await api.updateTopic(topicId, nextTitle);
                    setTopics((prev) => {
                        const exists = prev.some((t) => t.id === topicId);
                        if (!exists) return prev;
                        return prev.map((t) =>
                            t.id === topicId
                                ? { ...t, ...updated, id: updated.id ?? t.id }
                                : t,
                        );
                    });
                } catch {
                    // ignore title update failure
                }
            };

            if (targetLaterNode) {
                const now = new Date().toISOString();
                const targetParentId = getParentId(targetLaterNode);
                const optimisticNode: Node = {
                    ...targetLaterNode,
                    title: message,
                    summary: message,
                    type: "chat",
                    updatedAt: now,
                    parentId: targetParentId,
                    messages: [
                        { role: "user", content: message, createdAt: now },
                        {
                            role: "assistant",
                            content: "考え中…",
                            createdAt: now,
                            pending: true as any,
                        },
                    ],
                };
                const optimisticList = nodes.map((n) =>
                    n.id === targetLaterNode.id ? optimisticNode : n,
                );
                setNodes(optimisticList);
                setPath(buildPathLocal(targetLaterNode.id, optimisticList));
                setSelectedNodeId(targetLaterNode.id);
                setChatDraft("");

                const res = await api.postChat({
                    topicId,
                    message,
                    baseNodeId: targetParentId ?? undefined,
                    nodeId: targetLaterNode.id,
                });
                if (!createdTopicId) await maybeUpdateTitle();
                const updatedId =
                    res.node.nodeId ?? res.node.id ?? targetLaterNode.id;
                setSelectedNodeId(updatedId);
                await loadNodes(topicId, updatedId);
                return;
            }

            const targetBase = baseNodeId || activeNodeId || undefined;
            const now = new Date().toISOString();
            const tempId = `temp-${Date.now()}`;
            const optimisticLabel = generateLocalLabel(
                targetBase ?? null,
                nodes,
            );
            const optimisticNode: Node = {
                id: tempId,
                label: optimisticLabel,
                topicId,
                parentId: targetBase ?? null,
                title: message,
                summary: message,
                type: "chat",
                createdAt: now,
                updatedAt: now,
                messages: [
                    { role: "user", content: message, createdAt: now },
                    {
                        role: "assistant",
                        content: "考え中…",
                        createdAt: now,
                        pending: true as any,
                    },
                ],
            };
            const optimisticList = [...nodes, optimisticNode];
            setNodes(optimisticList);
            setPath(buildPathLocal(tempId, optimisticList));
            setSelectedNodeId(tempId);
            setChatDraft("");

            const res = await api.postChat({
                topicId,
                message,
                baseNodeId: targetBase,
            });
            if (!createdTopicId) await maybeUpdateTitle();
            const newId = res.node.id ?? res.node.nodeId;
            if (newId) setSelectedNodeId(newId);
            await loadNodes(topicId, newId ?? undefined);
        } catch (e) {
            if (!createdTopicId) {
                setTopics(prevTopics);
                setSelectedTopicId(prevSelectedTopicId);
                setPendingNewChat(prevPendingNewChat);
            }
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
        const baseNode = targetBase
            ? nodes.find((n) => n.id === targetBase)
            : null;
        if (baseNode?.type === "later") {
            setError("「あとで聞く」の下には追加できません。");
            return;
        }
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
        setLastLaterNodeId(tempId);
        setChatDraft("");

        try {
            const res = await api.createLaterNode({
                topicId: selectedTopicId ?? "",
                parentId: targetBase,
                summary: clean,
                label: optimisticLabel,
            });
            setLastLaterNodeId(res.id);
            await loadNodes(selectedTopicId ?? "", selectedNodeId);
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
        setPendingNewChat(false);
        setSelectedTopicId(id);
        setSelectedNodeId(null);
        setLastLaterNodeId(null);
        if (isMobile) {
            setMobileSection("chat");
            setMobileDrawer(null);
        }
        await loadNodes(id);
    };

    const handleNewChat = () => {
        setError(null);
        setPendingNewChat(true);
        setSelectedTopicId(null);
        setSelectedNodeId(null);
        setLastLaterNodeId(null);
        setChatDraft("");
        setNodes([]);
        setPath([]);
        if (isMobile) {
            setMobileSection("chat");
            setMobileDrawer(null);
        }
    };

    const handleLogout = () => {
        api.clearToken();
        auth.clearAuthArtifacts();
        setAuthenticated(false);
        setPendingNewChat(false);
        setTopics([]);
        setNodes([]);
        setPath([]);
        setSelectedNodeId(null);
        setLastLaterNodeId(null);
        setChatDraft("");
        setMobileDrawer(null);
        setLlmConfigured(null);
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
        if (isMobile) {
            setMobileSection("chat");
            setMobileDrawer(null);
            setTimeout(
                () => chatInputRef.current?.focus({ preventScroll: true }),
                0,
            );
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

    const activeNodeId = path[path.length - 1]?.id ?? null;
    const activeNode = path[path.length - 1] ?? null;
    const llmNeedsSetup = authenticated && llmConfigured === false;
    const treeNodes = useMemo(
        () => nodes.filter((n) => n.type !== "later"),
        [nodes],
    );
    type LaterItem = {
        id: string;
        text: string;
        createdAt: string;
        label?: string;
        parentLabel?: string;
        parentId?: string | null;
    };

    const laterItems: LaterItem[] = useMemo(() => {
        return nodes
            .filter((n) => n.type === "later")
            .map((n) => {
                const parentId = n.parentId ?? n.parentIds?.[0] ?? null;
                const parent = parentId
                    ? nodes.find(
                          (p) => p.id === parentId || p.nodeId === parentId,
                      )
                    : null;
                return {
                    id: n.id,
                    text: n.title || n.summary || "",
                    createdAt: n.createdAt,
                    label: n.label,
                    parentLabel: parent?.label,
                    parentId,
                };
            })
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }, [nodes]);
    const laterCounts = useMemo(() => {
        const map: Record<string, number> = {};
        nodes.forEach((n) => {
            if (n.type === "later") {
                const parentId = n.parentId ?? n.parentIds?.[0];
                if (parentId) {
                    map[parentId] = (map[parentId] || 0) + 1;
                }
            }
        });
        return map;
    }, [nodes]);
    const laterByParent = useMemo(() => {
        const map: Record<string, LaterItem[]> = {};
        laterItems.forEach((item) => {
            const key = item.parentId || "__root__";
            if (!map[key]) map[key] = [];
            map[key].push(item);
        });
        return map;
    }, [laterItems]);
    const selectedLaterItems = activeNodeId
        ? (laterByParent[activeNodeId] ?? [])
        : [];
    const panelLaterItems = selectedLaterItems;

    const left = (
        <div className={`sidebar ${topicsCollapsed ? "collapsed" : ""}`}>
            <div
                className={`sidebar-actions ${topicsCollapsed ? "collapsed" : ""}`}
            >
                <button
                    className="icon-btn"
                    aria-label={
                        topicsCollapsed
                            ? "サイドバーを開く"
                            : "サイドバーを畳む"
                    }
                    title={
                        topicsCollapsed
                            ? "サイドバーを開く"
                            : "サイドバーを畳む"
                    }
                    onClick={() => setTopicsCollapsed((v) => !v)}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                            d={
                                topicsCollapsed
                                    ? "M9 6l6 6-6 6"
                                    : "M15 6l-6 6 6 6"
                            }
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
                <button
                    className="sidebar-action primary"
                    aria-label="新しいチャット"
                    title="新しいチャット"
                    onClick={handleNewChat}
                    disabled={loading}
                >
                    <span className="sidebar-action-icon" aria-hidden="true">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M12 5v14M5 12h14"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                            />
                        </svg>
                    </span>
                    {!topicsCollapsed && <span>新しいチャット</span>}
                </button>
            </div>
            {!topicsCollapsed && (
                <div className="sidebar-scroll">
                    <TopicList
                        topics={topics}
                        selectedTopicId={selectedTopicId}
                        onSelect={handleSelectTopic}
                    />
                </div>
            )}
            <div className="sidebar-bottom">
                <HeaderMenu
                    onLogout={handleLogout}
                    placement="up"
                    align="left"
                    showLabel={!topicsCollapsed}
                    label="設定"
                    llmNeedsSetup={llmNeedsSetup}
                    onOpenLlm={() => setShowLlmModal(true)}
                />
            </div>
        </div>
    );

    const openLaterItem = (item: {
        id: string;
        text: string;
        parentId: string | null;
    }) => {
        const parentId = item.parentId;
        if (parentId) {
            selectNode(parentId);
        }
        setLastLaterNodeId(item.id);
        applyDraft(stripLaterPrefix(item.text));
        if (isMobile) {
            setMobileSection("chat");
            setTimeout(
                () => chatInputRef.current?.focus({ preventScroll: true }),
                0,
            );
        }
    };

    const handleDeleteLater = async (id: string) => {
        const target = nodes.find((n) => n.id === id);
        if (!target || target.type !== "later") return;
        const prevNodes = nodes;
        setNodes(nodes.filter((n) => n.id !== id));
        if (lastLaterNodeId === id) setLastLaterNodeId(null);
        setLoading(true);
        setError(null);
        try {
            await api.deleteNode(id);
        } catch (e) {
            setNodes(prevNodes);
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const center = (
        <div className="stack gap-s fill">
            <div className="tree-panel">
                <TreeView
                    nodes={treeNodes}
                    selectedNodeId={activeNodeId}
                    onSelect={(nodeId) => {
                        selectNode(nodeId);
                    }}
                    mainRef="main"
                    onPrefill={applyLaterDraft}
                    laterCounts={laterCounts}
                    laterItemsByParent={laterByParent}
                    isMobile={isMobile}
                />
            </div>
        </div>
    );

    const right = (
        <div className="stack gap-m fill">
            {llmNeedsSetup && (
                <div className="llm-banner card">
                    <div className="llm-banner-title">
                        LLM 設定が未完了です
                    </div>
                    <div className="llm-banner-body">
                        APIキーを登録するとチャットが有効になります。
                    </div>
                    <div className="llm-banner-actions">
                        <button
                            className="btn solid"
                            onClick={() => setShowLlmModal(true)}
                        >
                            LLM 設定を開く
                        </button>
                        <span className="llm-banner-meta">
                            設定は右上の「設定」からも開けます。
                        </span>
                    </div>
                </div>
            )}
            <ChatPanel
                path={path}
                loading={loading}
                onSend={handleSend}
                onAddLater={handleLater}
                draft={chatDraft}
                onDraftChange={handleDraftChange}
                onPrefillDraft={applyDraft}
                inputRef={chatInputRef}
                isMobile={isMobile}
                disableAddLater={
                    !selectedTopicId ||
                    pendingNewChat ||
                    activeNode?.type === "later"
                }
                laterItems={panelLaterItems}
                laterActiveId={lastLaterNodeId}
                onOpenLater={(item) => openLaterItem(item)}
                onDeleteLater={(item) => handleDeleteLater(item.id)}
            />
            {error && <div className="card error-card">エラー: {error}</div>}
        </div>
    );

    const mobileHeaderAction = (
        <div className="mobile-only">
            <button
                className={`icon-btn ${mobileDrawer === "topics" ? "active" : ""}`}
                type="button"
                aria-label="履歴"
                title="履歴"
                aria-pressed={mobileDrawer === "topics"}
                onClick={() => toggleMobileDrawer("topics")}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M4 6h16M4 12h16M4 18h16"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                    />
                </svg>
            </button>
            <button
                className={`icon-btn ${mobileDrawer === "tree" ? "active" : ""}`}
                type="button"
                aria-label="ツリー"
                title="ツリー"
                aria-pressed={mobileDrawer === "tree"}
                onClick={() => toggleMobileDrawer("tree")}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M7 4v8a3 3 0 0 0 3 3h7"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle
                        cx="7"
                        cy="4"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <circle
                        cx="10"
                        cy="15"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                    <circle
                        cx="17"
                        cy="15"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                    />
                </svg>
            </button>
            <HeaderMenu
                onLogout={handleLogout}
                placement="down"
                align="right"
                showLabel={false}
                label="設定"
                llmNeedsSetup={llmNeedsSetup}
                onOpenLlm={() => setShowLlmModal(true)}
            />
        </div>
    );

    const headerAction = (
        <>
            <div className="desktop-only">
                <HeaderMenu
                    onLogout={handleLogout}
                    placement="down"
                    align="right"
                    showLabel={false}
                    label="設定"
                    llmNeedsSetup={llmNeedsSetup}
                    onOpenLlm={() => setShowLlmModal(true)}
                />
            </div>
            {mobileHeaderAction}
        </>
    );

    if (!authenticated) {
        return (
            <LoginScreen
                onLogin={handleLoginStart}
                authError={authError}
                error={error}
                loading={loading}
            />
        );
    }

    return (
        <>
            <Layout
                left={left}
                center={center}
                right={right}
                headerAction={headerAction}
                leftCollapsed={topicsCollapsed}
                isMobile={isMobile}
                mobileSection={mobileSection}
                mobileDrawer={mobileDrawer}
                onMobileDrawerClose={() => setMobileDrawer(null)}
            />
            {showLlmModal && (
                <div
                    className="modal-backdrop"
                    onClick={() => setShowLlmModal(false)}
                >
                    <div
                        className="modal-card stack gap-m"
                        onClick={(e) => e.stopPropagation()}
                        style={{ minWidth: "min(380px, 92vw)" }}
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
                                <span style={{ fontWeight: 700 }}>
                                    LLM 設定
                                </span>
                                {!llmChecking && llmNeedsSetup && (
                                    <span className="settings-chip">
                                        未設定
                                    </span>
                                )}
                            </div>
                            <button
                                className="icon-btn"
                                aria-label="閉じる"
                                title="閉じる"
                                onClick={() => setShowLlmModal(false)}
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
                            onSaved={() => {
                                setLlmConfigured(true);
                                setShowLlmModal(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

export default App;
