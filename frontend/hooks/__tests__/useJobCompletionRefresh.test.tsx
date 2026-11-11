import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSummary } from "../../api/types";
import { useJobCompletionRefresh } from "../useJobCompletionRefresh";

const listJobs = vi.hoisted(() => vi.fn());
vi.mock("../../api/jobs", () => ({ listJobs }));

const job = (status: JobSummary["run"]["status"], finishedAt: string | null): JobSummary => ({
  id: "resync_all",
  run: { status, startedAt: null, finishedAt, result: null, error: null, progress: null },
  schedule: { enabled: false, cronExpression: null, nextRunAt: null, timezone: "UTC" },
  lastRun: null,
});

function setup(first: JobSummary[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  listJobs.mockResolvedValue(first);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  renderHook(() => useJobCompletionRefresh(), { wrapper });
  // Resolves once the hook has seen the first list.
  const ready = () => waitFor(() => expect(client.getQueryData(["jobs"])).toEqual(first));
  const check = async (next: JobSummary[]) => {
    listJobs.mockResolvedValue(next);
    await act(() => client.refetchQueries({ queryKey: ["jobs"] }));
  };
  return { invalidate, ready, check };
}

describe("useJobCompletionRefresh", () => {
  beforeEach(() => listJobs.mockReset());

  it("refetches everything but the jobs list when a running job finishes", async () => {
    const { invalidate, ready, check } = setup([job("running", null)]);
    await ready();

    await check([job("completed", "2026-11-01T10:00:00Z")]);

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    const predicate = invalidate.mock.calls[0][0]?.predicate;
    expect(predicate?.({ queryKey: ["games"] } as never)).toBe(true);
    expect(predicate?.({ queryKey: ["jobs"] } as never)).toBe(false);
  });

  it("refetches when a scheduled run finishes between two checks", async () => {
    const { invalidate, ready, check } = setup([job("completed", "2026-11-01T09:00:00Z")]);
    await ready();

    await check([job("completed", "2026-11-01T10:00:00Z")]);

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
  });

  it("does nothing on the first check, while nothing changes, or when a result is dismissed", async () => {
    const { invalidate, ready, check } = setup([job("completed", "2026-11-01T09:00:00Z")]);
    await ready();

    await check([job("completed", "2026-11-01T09:00:00Z")]);
    await check([job("idle", null)]);
    await check([job("running", null)]);

    expect(invalidate).not.toHaveBeenCalled();
  });
});
