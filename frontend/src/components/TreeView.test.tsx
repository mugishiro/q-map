import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TreeView from "./TreeView";
import { Node } from "../types";

const buildNode = (override: Partial<Node> = {}): Node => ({
  id: "node-root",
  label: "A1",
  topicId: "topic-1",
  parentId: null,
  title: "Root",
  summary: "Root summary",
  type: "chat",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  messages: [],
  ...override,
});

describe("TreeView", () => {
  it("renders nodes sorted by createdAt and shows labels", () => {
    const nodes: Node[] = [
      buildNode({
        id: "child",
        label: "B1",
        title: "Child node",
        parentId: "root",
        createdAt: "2024-01-02T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      }),
      buildNode({
        id: "root",
        label: "A1",
        title: "Root node",
        parentId: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId={null} onSelect={() => {}} />);

    const buttons = screen.getAllByRole("button");
    const labels = buttons.map((btn) => ({
      label: btn.querySelector(".git-label")?.textContent,
      title: btn.querySelector(".git-title-text")?.textContent,
    }));
    expect(labels).toEqual([
      { label: "A1", title: "Root node" },
      { label: "B1", title: "Child node" },
    ]);
  });

  it("calls onSelect when a node is clicked", async () => {
    const onSelect = vi.fn();
    const nodes: Node[] = [
      buildNode({ id: "root", title: "Root node" }),
      buildNode({
        id: "child",
        label: "B1",
        title: "Child node",
        parentId: "root",
        createdAt: "2024-01-02T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId={null} onSelect={onSelect} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Child node/ }));
    expect(onSelect).toHaveBeenCalledWith("child");
  });

  it("marks selected nodes and highlights 'later' nodes with ghost dots", () => {
    const nodes: Node[] = [
      buildNode({ id: "root", title: "Root node" }),
      buildNode({
        id: "later",
        label: "B2",
        title: "Later node",
        parentId: "root",
        type: "later",
        createdAt: "2024-01-02T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId="later" onSelect={() => {}} />);

    const laterButton = screen.getByRole("button", { name: /Later node/ });
    const row = laterButton.closest(".git-row");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("active");
    const dot = row?.querySelector(".git-dot");
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("ghost");
  });
});
