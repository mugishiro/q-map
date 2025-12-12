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

  it("treats nodes with missing parents as roots and preserves createdAt ordering", () => {
    const nodes: Node[] = [
      buildNode({ id: "root-1", label: "A1", title: "First root", createdAt: "2024-01-01T00:00:00Z" }),
      buildNode({
        id: "orphan",
        label: "B1",
        title: "Orphan node",
        parentId: "missing",
        createdAt: "2024-01-02T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId={null} onSelect={() => {}} />);

    const labels = screen.getAllByRole("button").map((btn) => ({
      label: btn.querySelector(".git-label")?.textContent,
      title: btn.querySelector(".git-title-text")?.textContent,
    }));
    expect(labels).toEqual([
      { label: "A1", title: "First root" },
      { label: "B1", title: "Orphan node" },
    ]);
  });

  it("keeps connector lines for middle siblings and stops at the last sibling", () => {
    const nodes: Node[] = [
      buildNode({ id: "root", label: "A1", title: "Root" }),
      buildNode({
        id: "child-1",
        label: "B1",
        title: "First child",
        parentId: "root",
        createdAt: "2024-01-02T00:00:00Z",
      }),
      buildNode({
        id: "child-2",
        label: "B2",
        title: "Second child",
        parentId: "root",
        createdAt: "2024-01-03T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId={null} onSelect={() => {}} />);

    const firstRow = screen.getByRole("button", { name: /First child/ }).closest(".git-row")!;
    const firstAncestorRail = firstRow.querySelectorAll(".git-rail")[0];
    expect(firstAncestorRail?.querySelector(".git-line.bottom")).not.toBeNull();

    const secondRow = screen.getByRole("button", { name: /Second child/ }).closest(".git-row")!;
    const secondAncestorRail = secondRow.querySelectorAll(".git-rail")[0];
    expect(secondAncestorRail?.querySelector(".git-line.bottom")).not.toBeNull();
  });

  it("draws a connector from root to a single child", () => {
    const nodes: Node[] = [
      buildNode({ id: "root", label: "A1", title: "Root" }),
      buildNode({
        id: "child",
        label: "B1",
        title: "Child",
        parentId: "root",
        createdAt: "2024-01-02T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId={null} onSelect={() => {}} />);

    const childRow = screen.getByRole("button", { name: /Child/ }).closest(".git-row")!;
    const rails = childRow.querySelectorAll(".git-rail");
    expect(rails[0]?.querySelector(".git-line.top")).not.toBeNull();
    expect(rails[0]?.querySelector(".git-line.bottom")).not.toBeNull();
  });

  it("allocates rail columns based on the deepest node", () => {
    const nodes: Node[] = [
      buildNode({ id: "root", label: "A1", title: "Root" }),
      buildNode({
        id: "child",
        label: "B1",
        title: "Child",
        parentId: "root",
        createdAt: "2024-01-02T00:00:00Z",
      }),
      buildNode({
        id: "grand",
        label: "C1",
        title: "Grandchild",
        parentId: "child",
        createdAt: "2024-01-03T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId="grand" onSelect={() => {}} />);

    const grandRow = screen.getByRole("button", { name: /Grandchild/ }).closest(".git-row")!;
    const rails = grandRow.querySelectorAll(".git-rail");
    expect(rails.length).toBe(3); // depth=2 => columns = 3
    expect(grandRow.classList.contains("active")).toBe(true);
  });
});
