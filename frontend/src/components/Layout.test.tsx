import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Layout from "./Layout";

const baseProps = {
  left: <div>LEFT</div>,
  center: <div>CENTER</div>,
  right: <div>RIGHT</div>,
};

describe("Layout", () => {
  it("デスクトップでは左右のパネルを表示する", () => {
    render(<Layout {...baseProps} isMobile={false} />);

    expect(screen.getByText("LEFT")).toBeInTheDocument();
    expect(screen.getByText("CENTER")).toBeInTheDocument();
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("モバイルでは履歴ドロワーに左パネルを表示する", async () => {
    const onClose = vi.fn();
    render(
      <Layout
        {...baseProps}
        isMobile
        mobileDrawer="topics"
        onMobileDrawerClose={onClose}
      />,
    );

    expect(screen.getByText("RIGHT")).toBeInTheDocument();
    expect(screen.getByText("履歴")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("LEFT");
    expect(screen.queryByText("CENTER")).not.toBeInTheDocument();

    const user = userEvent.setup();
    const closeButtons = screen.getAllByRole("button", { name: "閉じる" });
    await user.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("モバイルではツリードロワーに中央パネルを表示する", () => {
    render(<Layout {...baseProps} isMobile mobileDrawer="tree" />);

    expect(screen.getByText("RIGHT")).toBeInTheDocument();
    expect(screen.getByText("ツリー")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("CENTER");
    expect(screen.queryByText("LEFT")).not.toBeInTheDocument();
  });
});
