import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PathView } from "./PathView";
import { Node } from "../types";

const buildNode = (override: Partial<Node> = {}): Node => ({
  id: "node-1",
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

describe("PathView", () => {
  it("shows empty state when no path is provided", () => {
    render(<PathView path={[]} onSelect={() => {}} />);
    expect(screen.getByText("ノードを選択してください")).toBeInTheDocument();
  });

  it("renders chips for each node in the path and fires onSelect", async () => {
    const onSelect = vi.fn();
    const path: Node[] = [
      buildNode({ id: "root", label: "A1", title: "Root" }),
      buildNode({ id: "child", label: "B1", title: "Child" }),
    ];

    render(<PathView path={path} onSelect={onSelect} />);

    const chips = screen.getAllByRole("button");
    expect(chips.map((c) => c.textContent?.trim())).toEqual(["A1. Root", "B1. Child"]);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /B1. Child/ }));
    expect(onSelect).toHaveBeenCalledWith("child");
  });
});
