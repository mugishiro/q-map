import {
    CSSProperties,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
} from "react";
import { Node } from "../types";

type GraphNode = Node & {
    lane: number;
    y: number;
    parents: string[];
    color: string;
};

type GraphEdge = {
    parentId: string;
    childId: string;
    from: { lane: number; y: number };
    to: { lane: number; y: number };
    isMain: boolean;
    color: string;
};

type Props = {
    nodes: Node[];
    selectedNodeId: string | null;
    onSelect: (nodeId: string) => void;
    mainRef?: string; // label or id that should stick to lane 0 if possible
    onPrefill?: (text: string) => void;
    laterCounts?: Record<string, number>;
    laterItemsByParent?: Record<
        string,
        {
            id: string;
            text: string;
            label?: string;
            parentLabel?: string;
            createdAt: string;
        }[]
    >;
};

const ROW_HEIGHT = 48;
const BASE_LANE_GAP = 64;
const LANE_GAP_MIN = 48;
const PADDING_X = 24;
const PADDING_Y = 20;
const LIST_WIDTH = 280;
const MIN_CANVAS_HEIGHT = 520;
const PATH_COLOR = "#22c55e";
const OTHER_COLOR = "#5ca9e6";
const PATH_EMPHASIS = 0.92;
const NON_PATH_OPACITY = 0.62;
const TOOLTIP_MAX_WIDTH = 280;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_TOP_THRESHOLD = 56;
const TOOLTIP_OFFSET = 12;

const byCreatedAt = (a: Node, b: Node) => {
    if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
};

const parentKey = (id: string | null | undefined) => id ?? "__root__";

const buildGraph = (
    nodes: (Node & { isPlaceholder?: boolean; hiddenCount?: number })[],
    mainRef?: string,
) => {
    const sorted = nodes.slice().sort(byCreatedAt);

    const laneById = new Map<string, number>();
    const processedChildCount = new Map<string, number>();
    const positionById = new Map<string, { lane: number; y: number }>();

    const graphNodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let laneCounter = -1;

    sorted.forEach((node, idx) => {
        const parents =
            ((node as any).parentIds as string[] | undefined) ??
            (node.parentId ? [node.parentId] : []);
        const primaryParent = parents[0];

        let lane: number;
        const parentLane = primaryParent
            ? laneById.get(primaryParent)
            : undefined;
        const processedCount = primaryParent
            ? (processedChildCount.get(primaryParent) ?? 0)
            : 0;

        const isMainRef = mainRef
            ? node.label === mainRef || node.id === mainRef
            : false;

        if (isMainRef && laneById.has(node.id)) {
            lane = laneById.get(node.id)!;
        } else if (primaryParent && parentLane !== undefined) {
            lane =
                processedCount === 0
                    ? parentLane
                    : (laneById.get(node.id) ?? ++laneCounter);
        } else if (isMainRef) {
            lane = 0;
        } else {
            lane = laneById.get(node.id) ?? ++laneCounter;
        }

        laneById.set(node.id, lane);
        laneCounter = Math.max(laneCounter, lane);
        if (primaryParent) {
            processedChildCount.set(primaryParent, processedCount + 1);
        }

        const y = PADDING_Y + idx * ROW_HEIGHT;
        const color = OTHER_COLOR;
        const gNode: GraphNode = { ...node, lane, y, parents, color };
        graphNodes.push(gNode);
        positionById.set(node.id, { lane, y });

        parents.forEach((pid) => {
            const pos = positionById.get(pid);
            const pLane = laneById.get(pid);
            if (pos && pLane !== undefined) {
                const edgeColor = OTHER_COLOR;
                edges.push({
                    parentId: pid,
                    childId: node.id,
                    from: { lane: pLane, y: pos.y },
                    to: { lane, y },
                    isMain: lane === 0 || pLane === 0,
                    color: edgeColor,
                });
            }
        });
    });

    const laneCount = Math.max(1, ...graphNodes.map((n) => n.lane + 1));
    const density = Math.min(1, graphNodes.length / Math.max(1, laneCount * 8));
    const laneGap = Math.max(LANE_GAP_MIN, BASE_LANE_GAP * (1 - density * 0.4));
    const maxRow = Math.max(0, graphNodes.length - 1);
    const height = Math.max(
        MIN_CANVAS_HEIGHT,
        PADDING_Y * 2 + maxRow * ROW_HEIGHT,
    );
    const width = PADDING_X * 2 + laneCount * laneGap;

    return { graphNodes, edges, laneCount, height, width, laneGap };
};

const laneX = (lane: number, gap: number) => PADDING_X + lane * gap;

const edgePath = (
    from: { lane: number; y: number },
    to: { lane: number; y: number },
    gap: number,
) => {
    const x1 = laneX(from.lane, gap);
    const x2 = laneX(to.lane, gap);
    const y1 = from.y;
    const y2 = to.y;
    // straight if same lane
    if (from.lane === to.lane) return `M ${x1} ${y1} L ${x1} ${y2}`;
    // branch: go horizontal at parent level, then down
    const radius = 5;
    const dir = x2 > x1 ? 1 : -1;
    return [
        `M ${x1} ${y1}`,
        `L ${x2 - dir * radius} ${y1}`,
        `Q ${x2} ${y1} ${x2} ${y1 + radius}`,
        `L ${x2} ${y2}`,
    ].join(" ");
};

export const TreeView = ({
    nodes,
    selectedNodeId,
    onSelect,
    mainRef,
    onPrefill,
    laterCounts,
    laterItemsByParent,
}: Props) => {
    const shellRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [listOpen, setListOpen] = useState(true);
    const [listTooltipId, setListTooltipId] = useState<string | null>(null);
    const [nodeTooltip, setNodeTooltip] = useState<{
        text: string;
        x: number;
        y: number;
        align: "left" | "center" | "right";
        placement: "top" | "bottom";
    } | null>(null);
    const [showScrollControls, setShowScrollControls] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [laterPopover, setLaterPopover] = useState<{
        x: number;
        y: number;
        items: {
            id: string;
            text: string;
            label?: string;
            parentLabel?: string;
            createdAt: string;
        }[];
    } | null>(null);

    const isTruncated = (el: HTMLElement | null) => {
        if (!el) return false;
        return (
            el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
        );
    };

    const handleListEnter = (id: string, el: HTMLElement | null) => {
        setHoveredNodeId(id);
        setListTooltipId(isTruncated(el) ? id : null);
    };

    const handleListLeave = () => {
        setHoveredNodeId(null);
        setListTooltipId(null);
    };

    const showNodeTooltip = (
        event: MouseEvent<HTMLButtonElement>,
        text: string,
    ) => {
        if (!shellRef.current) return;
        const shellRect = shellRef.current.getBoundingClientRect();
        const nodeRect = event.currentTarget.getBoundingClientRect();
        const anchorX = nodeRect.left - shellRect.left + nodeRect.width / 2;
        const top = nodeRect.top - shellRect.top;
        const bottom = nodeRect.bottom - shellRect.top;
        let align: "left" | "center" | "right" = "center";
        if (anchorX < TOOLTIP_MAX_WIDTH / 2 + TOOLTIP_MARGIN) {
            align = "left";
        } else if (
            anchorX >
            shellRect.width - TOOLTIP_MAX_WIDTH / 2 - TOOLTIP_MARGIN
        ) {
            align = "right";
        }
        const placement = top < TOOLTIP_TOP_THRESHOLD ? "bottom" : "top";
        const y =
            placement === "top"
                ? top - TOOLTIP_OFFSET
                : bottom + TOOLTIP_OFFSET;
        setNodeTooltip({ text, x: anchorX, y, align, placement });
    };

    const hideNodeTooltip = () => {
        setNodeTooltip(null);
    };

    const updateScrollState = useCallback(() => {
        const el = canvasRef.current;
        if (!el) return;
        const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        setShowScrollControls(maxScrollLeft > 1);
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft < maxScrollLeft - 1);
    }, []);

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const handle = () => updateScrollState();
        handle();
        el.addEventListener("scroll", handle);
        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(handle);
            observer.observe(el);
        }
        window.addEventListener("resize", handle);
        return () => {
            el.removeEventListener("scroll", handle);
            window.removeEventListener("resize", handle);
            observer?.disconnect();
        };
    }, [updateScrollState]);

    const scrollCanvas = (direction: -1 | 1) => {
        const el = canvasRef.current;
        if (!el) return;
        const amount = Math.max(160, Math.round(el.clientWidth * 0.6));
        el.scrollBy({ left: amount * direction, behavior: "smooth" });
    };

    const visibleNodes = useMemo(() => {
        return nodes.slice().sort(byCreatedAt);
    }, [nodes]);

    const { graphNodes, edges, laneCount, height, width, laneGap } = useMemo(
        () => buildGraph(visibleNodes, mainRef),
        [visibleNodes, mainRef],
    );

    useEffect(() => {
        updateScrollState();
    }, [updateScrollState, width, listOpen, nodes.length]);

    const { pathNodeSet, pathEdgeSet } = useMemo(() => {
        const byChild = new Map<string, string>();
        edges.forEach((e) => {
            if (!byChild.has(e.childId)) {
                byChild.set(e.childId, e.parentId);
            }
        });
        const nodeSet = new Set<string>();
        const edgeSet = new Set<string>();
        let cur: string | null | undefined = selectedNodeId;
        while (cur) {
            if (nodeSet.has(cur)) break;
            nodeSet.add(cur);
            const parent = byChild.get(cur);
            if (!parent) break;
            edgeSet.add(`${parent}|${cur}`);
            cur = parent;
        }
        return { pathNodeSet: nodeSet, pathEdgeSet: edgeSet };
    }, [edges, selectedNodeId]);

    return (
        <div className="stack gap-m fill">
            <div
                ref={shellRef}
                className="tree gitk-shell gitk-with-list"
                style={{ height: "100%", minHeight: `${MIN_CANVAS_HEIGHT}px` }}
            >
                <div className="gitk-list-toolbar">
                    <div className="gitk-toolbar">
                        {showScrollControls && (
                            <div
                                className="gitk-scroll-controls"
                                aria-label="横スクロール"
                            >
                                <button
                                    className="gitk-scroll-btn"
                                    onClick={() => scrollCanvas(-1)}
                                    type="button"
                                    aria-label="左にスクロール"
                                    title="左にスクロール"
                                    disabled={!canScrollLeft}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M15 6l-6 6 6 6"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </button>
                                <button
                                    className="gitk-scroll-btn"
                                    onClick={() => scrollCanvas(1)}
                                    type="button"
                                    aria-label="右にスクロール"
                                    title="右にスクロール"
                                    disabled={!canScrollRight}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M9 6l6 6-6 6"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        )}
                        <button
                            className={`gitk-list-toggle ${listOpen ? "active" : ""}`}
                            onClick={() => setListOpen((v) => !v)}
                            type="button"
                            aria-pressed={listOpen}
                            aria-label="ノード一覧を切り替える"
                            title={listOpen ? "一覧を閉じる" : "一覧を開く"}
                        >
                            <span
                                className="gitk-list-toggle-icon"
                                aria-hidden="true"
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M4 6h16M4 12h16M4 18h16"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                            <span>一覧</span>
                        </button>
                    </div>
                </div>
                <div className="gitk-body" style={{ height }}>
                    <div
                        ref={canvasRef}
                        className="gitk-canvas"
                        style={{ height }}
                    >
                        <div className="gitk-graph" style={{ width, height }}>
                            {!graphNodes.length && (
                                <div className="gitk-empty">ノードなし</div>
                            )}
                            <svg
                                className="gitk-svg"
                                width={width}
                                height={height}
                            >
                                {edges.map((e, idx) => {
                                    const isPathEdge = pathEdgeSet.has(
                                        `${e.parentId}|${e.childId}`,
                                    );
                                    const edgeColor = isPathEdge
                                        ? PATH_COLOR
                                        : OTHER_COLOR;
                                    const edgeStyle: CSSProperties | undefined =
                                        {
                                            stroke: edgeColor,
                                            strokeOpacity: isPathEdge
                                                ? PATH_EMPHASIS
                                                : NON_PATH_OPACITY,
                                            strokeWidth: isPathEdge ? 2.6 : 2,
                                        };
                                    return (
                                        <path
                                            key={`${e.from.lane}-${e.to.lane}-${idx}`}
                                            d={edgePath(e.from, e.to, laneGap)}
                                            className={`gitk-edge ${e.isMain ? "main" : ""} ${isPathEdge ? "path" : ""}`}
                                            style={edgeStyle}
                                        />
                                    );
                                })}
                            </svg>
                            {laterPopover && laterPopover.items.length > 0 && (
                                <div
                                    className="later-popover"
                                    style={{
                                        top: laterPopover.y,
                                        left: laterPopover.x,
                                        transform: "translate(0, -100%)",
                                    }}
                                    onMouseLeave={() => setLaterPopover(null)}
                                >
                                    <div className="later-popover-title">
                                        後で聞く
                                    </div>
                                    <div className="later-popover-list">
                                        {laterPopover.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className="later-popover-item"
                                            >
                                                <div className="later-popover-text">
                                                    {item.text || "(no title)"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {graphNodes.map((n) => {
                                const x = laneX(n.lane, laneGap);
                                const isSelected = selectedNodeId === n.id;
                                const onPath = pathNodeSet.has(n.id);
                                const isHovered = hoveredNodeId === n.id;
                                const isMainLane = n.lane === 0;
                                const laterCount = laterCounts?.[n.id] ?? 0;
                                const tooltip = n.title || n.summary || "";
                                const nodeColor =
                                    onPath || isSelected
                                        ? PATH_COLOR
                                        : OTHER_COLOR;
                                const nodeStyle: CSSProperties & {
                                    ["--branch-color"]?: string;
                                    ["--branch-emphasis"]?: string;
                                } = {
                                    top: n.y,
                                    left: x,
                                    "--branch-color": nodeColor,
                                    "--branch-emphasis":
                                        onPath || isSelected
                                            ? nodeColor
                                            : "transparent",
                                };
                                return (
                                    <div key={n.id}>
                                        <button
                                            className={`gitk-node ${isSelected ? "active" : ""} ${n.type === "later" ? "later" : ""} ${
                                                onPath ? "path" : ""
                                            } ${isHovered ? "hovered" : ""} ${isMainLane ? "main" : ""}`}
                                            style={nodeStyle}
                                            data-node-id={n.id}
                                            data-lane={n.lane}
                                            data-testid="gitk-node"
                                            onClick={() => {
                                                onSelect(n.id);
                                                if (
                                                    n.type === "later" &&
                                                    onPrefill
                                                ) {
                                                    const text =
                                                        n.title ||
                                                        n.summary ||
                                                        "";
                                                    if (text) onPrefill(text);
                                                }
                                            }}
                                            onMouseEnter={(event) => {
                                                setHoveredNodeId(n.id);
                                                if (tooltip)
                                                    showNodeTooltip(
                                                        event,
                                                        tooltip,
                                                    );
                                            }}
                                            onMouseLeave={() => {
                                                setHoveredNodeId(null);
                                                hideNodeTooltip();
                                            }}
                                            type="button"
                                            aria-label={
                                                n.title || n.summary || "node"
                                            }
                                        >
                                            <span className="gitk-dot-btn">
                                                <span className="gitk-dot" />
                                            </span>
                                        </button>
                                        {laterCount > 0 && (
                                            <span
                                                className="gitk-later-badge"
                                                style={{
                                                    top: n.y - 8,
                                                    left: x + 14,
                                                }}
                                                aria-label={`後で聞く ${laterCount}件`}
                                                title={`後で聞く ${laterCount}件`}
                                                onMouseEnter={() => {
                                                    const items =
                                                        laterItemsByParent?.[
                                                            n.id
                                                        ] ?? [];
                                                    const anchorX = x + 20;
                                                    const minX = PADDING_X + 8;
                                                    const clampedX = Math.max(
                                                        minX,
                                                        anchorX,
                                                    );
                                                    setLaterPopover({
                                                        x: clampedX,
                                                        y: n.y - 18,
                                                        items,
                                                    });
                                                }}
                                                onMouseLeave={() =>
                                                    setLaterPopover(null)
                                                }
                                            >
                                                {laterCount}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {listOpen && (
                        <div
                            className="gitk-list"
                            style={
                                {
                                    height,
                                    "--list-width": `${LIST_WIDTH}px`,
                                } as CSSProperties & {
                                    ["--list-width"]: string;
                                }
                            }
                        >
                            {graphNodes.map((n) => {
                                const isSelected = selectedNodeId === n.id;
                                const onPath = pathNodeSet.has(n.id);
                                const isHovered = hoveredNodeId === n.id;
                                const label =
                                    n.title || n.summary || "(no title)";
                                const color =
                                    onPath || isSelected
                                        ? PATH_COLOR
                                        : OTHER_COLOR;
                                const listStyle: CSSProperties & {
                                    ["--branch-color"]?: string;
                                } = {
                                    top: n.y,
                                    "--branch-color": color,
                                };
                                return (
                                    <button
                                        key={`list-${n.id}`}
                                        className={`gitk-list-item ${isSelected ? "active" : ""} ${onPath ? "path" : ""} ${
                                            n.type === "later" ? "later" : ""
                                        } ${isHovered ? "hovered" : ""} ${listTooltipId === n.id ? "has-tooltip" : ""}`}
                                        style={listStyle}
                                        onClick={() => {
                                            onSelect(n.id);
                                        }}
                                        onMouseEnter={(event) => {
                                            const titleEl =
                                                event.currentTarget.querySelector<HTMLElement>(
                                                    ".gitk-list-title",
                                                );
                                            handleListEnter(n.id, titleEl);
                                        }}
                                        onMouseLeave={handleListLeave}
                                        type="button"
                                        data-tooltip={
                                            listTooltipId === n.id
                                                ? label
                                                : undefined
                                        }
                                    >
                                        <div className="gitk-list-bar" />
                                        <div className="gitk-list-body">
                                            <div className="gitk-list-title">
                                                {label}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                {nodeTooltip && (
                    <div
                        className={`gitk-tooltip ${nodeTooltip.align === "center" ? "" : `align-${nodeTooltip.align}`} ${
                            nodeTooltip.placement === "bottom" ? "bottom" : ""
                        }`}
                        style={
                            {
                                left: nodeTooltip.x,
                                top: nodeTooltip.y,
                                "--tooltip-max-width": `${TOOLTIP_MAX_WIDTH}px`,
                            } as CSSProperties
                        }
                    >
                        {nodeTooltip.text}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TreeView;
