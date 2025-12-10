import { useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout";
import { TopicList } from "./components/TopicList";
import { TreeView } from "./components/TreeView";
import { PathView } from "./components/PathView";
import ChatPanel from "./components/ChatPanel";
import HeaderAuth from "./components/HeaderAuth";
import { api } from "./api";
import { auth } from "./auth";
import { Node, Topic } from "./types";

function App() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [path, setPath] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTopicName = useMemo(
    () => topics.find((t) => t.id === selectedTopicId)?.name ?? "",
    [topics, selectedTopicId]
  );

  const refreshTopics = async () => {
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
    refreshTopics();
  }, []);

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

  const loadNodes = async (topicId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listNodes(topicId, false);
      const mapped = res.items.map((n: any) => ({
        id: n.nodeId ?? n.id,
        ...n,
      }));
      setNodes(mapped);
      setPath([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadPath = async (nodeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getNodePath(nodeId);
      const mapped = res.path.map((n: any) => ({ id: n.nodeId ?? n.id, ...n }));
      setPath(mapped);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTopicId) loadNodes(selectedTopicId);
  }, [selectedTopicId]);

  const handleSend = async ({ message, baseNodeId }: { message: string; baseNodeId?: string }) => {
    if (!selectedTopicId) return;
    setLoading(true);
    setError(null);
    try {
      await api.postChat({ topicId: selectedTopicId, message, baseNodeId });
      await loadNodes(selectedTopicId);
      if (baseNodeId) {
        await loadPath(baseNodeId);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLater = async ({ summary }: { summary: string }) => {
    if (!selectedTopicId) return;
    const parentId = path[path.length - 1]?.id ?? null;
    if (!parentId) return;
    setLoading(true);
    setError(null);
    try {
      await api.createLaterNode({ topicId: selectedTopicId, parentId, summary });
      await loadNodes(selectedTopicId);
      await loadPath(parentId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTopic = async (id: string) => {
    setSelectedTopicId(id);
    await loadNodes(id);
  };

  const handleCreateTopic = async (name: string) => {
    await api.createTopic(name);
    await refreshTopics();
  };

  const left = (
    <TopicList
      topics={topics}
      selectedTopicId={selectedTopicId}
      onSelect={handleSelectTopic}
      onCreate={handleCreateTopic}
    />
  );

  const center = (
    <TreeView
      nodes={nodes}
      selectedNodeId={path[path.length - 1]?.id ?? null}
      onSelect={(nodeId) => loadPath(nodeId)}
    />
  );

  const right = (
    <div className="stack gap-m">
      <div className="label">選択中のトピック</div>
      <div className="card">{selectedTopicName || "トピックを選択してください"}</div>
      <PathView path={path} onSelect={(id) => loadPath(id)} />
      <ChatPanel path={path} loading={loading} onSend={handleSend} onAddLater={handleLater} />
      {error && <div className="card" style={{ color: "#b91c1c" }}>エラー: {error}</div>}
    </div>
  );

  const headerAction = <HeaderAuth onAuthChange={refreshTopics} />;

  return <Layout left={left} center={center} right={right} headerAction={headerAction} />;
}

export default App;
