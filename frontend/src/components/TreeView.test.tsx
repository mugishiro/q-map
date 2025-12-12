import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TreeView from "./TreeView";
import { Node } from "../types";

const buildNode = (override: Partial<Node> = {}): Node => ({
  id: "n-root",
  label: "A1",
  topicId: "t1",
  parentId: null,
  title: "Root",
  summary: "Root summary",
  type: "chat",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  messages: [],
  ...override,
});

const getNode = (title: string) =>
  screen.getAllByTestId("gitk-node").find((el) => (el.getAttribute("title") || "").includes(title));

describe("TreeView (git-style graph)", () => {
  it("keeps parent lane for the first child and shifts siblings to new lanes", () => {
    const nodes: Node[] = [
      buildNode({ id: "root", label: "A1", title: "Root" }),
      buildNode({
        id: "child1",
        label: "B1",
        title: "First child",
        parentId: "root",
        createdAt: "2024-01-02T00:00:00Z",
      }),
      buildNode({
        id: "child2",
        label: "B2",
        title: "Second child",
        parentId: "root",
        createdAt: "2024-01-03T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId={null} onSelect={() => {}} />);

    const root = getNode("Root")!;
    const c1 = getNode("First child")!;
    const c2 = getNode("Second child")!;
    expect(root.getAttribute("data-lane")).toBe("0");
    expect(c1.getAttribute("data-lane")).toBe("0"); // first child stays on same lane
    expect(c2.getAttribute("data-lane")).toBe("1"); // next sibling moves to new lane
  });

  it("draws edges between parent and child rows", () => {
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

    const paths = document.querySelectorAll("path.gitk-edge");
    expect(paths.length).toBe(1);
    const d = paths[0].getAttribute("d");
    expect(d).toContain("C"); // cubic bezier
  });

  it("respects selection state and onSelect handler", async () => {
    const onSelect = vi.fn();
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

    render(<TreeView nodes={nodes} selectedNodeId={"child"} onSelect={onSelect} />);

    const child = getNode("Child")!;
    expect(child.classList.contains("active")).toBe(true);

    const user = userEvent.setup();
    await user.click(child.querySelector("button")!);
    expect(onSelect).toHaveBeenCalledWith("child");
  });

  it("keeps mainRef on lane 0 when specified", () => {
    const nodes: Node[] = [
      buildNode({ id: "branch", label: "feature", title: "Feature root" }),
      buildNode({
        id: "main",
        label: "main",
        title: "Main root",
        parentId: null,
        createdAt: "2024-01-02T00:00:00Z",
      }),
    ];

    render(<TreeView nodes={nodes} selectedNodeId={null} onSelect={() => {}} mainRef="main" />);

    const main = getNode("Main root")!;
    expect(main.getAttribute("data-lane")).toBe("0");
  });
});
