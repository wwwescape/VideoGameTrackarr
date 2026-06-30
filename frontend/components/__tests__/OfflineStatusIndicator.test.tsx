import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager, useMutation } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "react-toastify";
import OfflineStatusIndicator from "../OfflineStatusIndicator";

vi.mock("react-toastify", () => ({
  toast: { warning: vi.fn(), success: vi.fn() },
}));

function renderWithClient(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<OfflineStatusIndicator />, { wrapper: Wrapper });
}

describe("OfflineStatusIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("renders nothing while online with no pending mutations", () => {
    renderWithClient(new QueryClient());

    expect(screen.queryByText(/Offline/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Syncing/)).not.toBeInTheDocument();
  });

  it("shows an Offline chip and warns once when going offline", () => {
    renderWithClient(new QueryClient());

    act(() => {
      onlineManager.setOnline(false);
    });

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(toast.warning).toHaveBeenCalledOnce();
  });

  it("shows the pending-change count on the chip while a mutation is paused offline", async () => {
    const queryClient = new QueryClient();
    function TriggerMutation() {
      const mutation = useMutation({ mutationFn: () => new Promise<void>(() => {}) });
      return <button onClick={() => mutation.mutate()}>trigger</button>;
    }
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    render(
      <>
        <TriggerMutation />
        <OfflineStatusIndicator />
      </>,
      { wrapper: Wrapper }
    );

    act(() => {
      onlineManager.setOnline(false);
    });
    screen.getByText("trigger").click();

    await waitFor(() => expect(screen.getByText("Offline · 1 change pending")).toBeInTheDocument());
  });

  it("toasts a success message once pending changes finish syncing", async () => {
    const queryClient = new QueryClient();
    let resolveMutation: (() => void) | undefined;
    function TriggerMutation() {
      const mutation = useMutation({
        mutationFn: () => new Promise<void>((resolve) => (resolveMutation = resolve)),
      });
      return <button onClick={() => mutation.mutate()}>trigger</button>;
    }
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    render(
      <>
        <TriggerMutation />
        <OfflineStatusIndicator />
      </>,
      { wrapper: Wrapper }
    );

    // While offline, networkMode: 'online' (the default) defers ever calling mutationFn at
    // all - it only actually runs once the mutation resumes after reconnecting.
    act(() => {
      onlineManager.setOnline(false);
    });
    screen.getByText("trigger").click();
    await waitFor(() => expect(screen.getByText("Offline · 1 change pending")).toBeInTheDocument());

    act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(resolveMutation).toBeDefined());
    resolveMutation?.();

    await waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
  });
});
