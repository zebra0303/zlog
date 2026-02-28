import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfirmModal } from "../ConfirmModal";
import { useConfirm } from "../useConfirm";

// Mock the react portal so it renders in the normal DOM tree
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node, // Return node directly
  };
});

describe("ConfirmModal", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // jsdom doesn't support dialog elements natively yet, so mock showModal and close
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();

    useConfirm.setState({
      isOpen: false,
      message: "",
      onConfirm: mockOnConfirm,
      onCancel: mockOnCancel,
    });
  });

  it("does not render when isOpen is false", () => {
    useConfirm.setState({ isOpen: false });
    const { container } = render(<ConfirmModal />);
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("renders with the correct message when isOpen is true", () => {
    useConfirm.setState({ isOpen: true, message: "Are you absolutely sure?" });
    const { container } = render(<ConfirmModal />);

    expect(container.querySelector("dialog")).toBeInTheDocument();
    expect(screen.getByText("Are you absolutely sure?")).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    useConfirm.setState({ isOpen: true, message: "Will be deleted." });
    render(<ConfirmModal />);

    const confirmButton = screen.getByText("Confirm");
    fireEvent.click(confirmButton);
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    useConfirm.setState({ isOpen: true, message: "Will be deleted." });
    render(<ConfirmModal />);

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
