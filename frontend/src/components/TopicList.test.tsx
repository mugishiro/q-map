import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TopicList } from "./TopicList";
import { Topic } from "../types";

const buildTopic = (override: Partial<Topic> = {}): Topic => ({
  id: "topic-1",
  name: "テストチャット",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...override,
});

describe("TopicList", () => {
  it("履歴ラベルやアイコンを表示せずトピック名のみ表示する", async () => {
    const onSelect = vi.fn();
    const topics = [buildTopic(), buildTopic({ id: "topic-2", name: "別のチャット" })];

    render(<TopicList topics={topics} selectedTopicId={null} onSelect={onSelect} />);

    expect(screen.queryByText("履歴")).not.toBeInTheDocument();
    expect(document.querySelector(".list-icon")).toBeNull();
    expect(screen.getByText("テストチャット")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "別のチャット" }));
    expect(onSelect).toHaveBeenCalledWith("topic-2");
  });
});
