import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout";
import { TopicList } from "./components/TopicList";
import { TreeView } from "./components/TreeView";
import ChatPanel from "./components/ChatPanel";
import HeaderMenu from "./components/HeaderMenu";
import { api } from "./api";
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
    const [isMobile, setIsMobile] = useState(false);
    const [mobileSection, setMobileSection] = useState<
        "topics" | "tree" | "chat"
    >("tree");
    const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

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

    const refreshTopics = async (preferredId?: string | null) => {
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
        void refreshTopics();
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
        if (isMobile) setMobileSection("tree");
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
        if (isMobile) setMobileSection("chat");
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
            setTimeout(
                () => chatInputRef.current?.focus({ preventScroll: true }),
                0,
            );
        }
    };

    const activeNodeId = path[path.length - 1]?.id ?? null;
    const activeNode = path[path.length - 1] ?? null;
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
                    placement="up"
                    align="left"
                    showLabel={!topicsCollapsed}
                    label="設定"
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
                />
            </div>
        </div>
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

    return (
        <Layout
            left={left}
            center={center}
            right={right}
            leftCollapsed={topicsCollapsed}
            isMobile={isMobile}
            mobileSection={mobileSection}
            onMobileSectionChange={setMobileSection}
        />
    );
}

export default App;
