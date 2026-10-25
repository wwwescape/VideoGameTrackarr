import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { JobSummary } from "../../api/types";
import JobsSection from "../JobsSection";

const runJob = vi.fn(async () => undefined);
const updateSchedule = vi.fn(async () => undefined);
let jobs: JobSummary[] = [];

vi.mock("../../hooks/useJobs", () => ({
  useJobsList: () => ({ data: jobs }),
  useRunJob: () => ({ mutateAsync: runJob }),
  useAcknowledgeJobStatus: () => ({ mutateAsync: vi.fn() }),
  useUpdateJobSchedule: () => ({ mutateAsync: updateSchedule, isPending: false }),
}));

const job = (overrides: Partial<JobSummary> = {}): JobSummary => ({
  id: "resync_all",
  run: { status: "idle", startedAt: null, finishedAt: null, result: null, error: null, progress: null },
  schedule: { enabled: false, cronExpression: null, nextRunAt: null },
  ...overrides,
});

const group = () => screen.getByRole("heading", { name: "Resync Games, Collections & Series" }).closest("section") as HTMLElement;

describe("JobsSection", () => {
  it("shows each job as a group with its status, Run and Schedule rows", () => {
    jobs = [job()];
    render(<JobsSection />);

    expect(within(group()).getByText("Idle")).toBeInTheDocument();
    expect(within(group()).getByText("Not scheduled")).toBeInTheDocument();
    expect(within(group()).getByRole("button", { name: "Run now" })).toBeEnabled();
  });

  it("runs a job now", async () => {
    jobs = [job()];
    render(<JobsSection />);

    await userEvent.click(within(group()).getByRole("button", { name: "Run now" }));
    expect(runJob).toHaveBeenCalledWith("resync_all");
  });

  it("shows a running job's progress and can't run it twice", () => {
    jobs = [job({ run: { status: "running", startedAt: null, finishedAt: null, result: null, error: null, progress: { current: 3, total: 9 } } })];
    render(<JobsSection />);

    expect(within(group()).getByRole("progressbar")).toBeInTheDocument();
    expect(within(group()).getByText("3 of 9")).toBeInTheDocument();
    expect(within(group()).getByRole("button", { name: "Run now" })).toBeDisabled();
  });

  it("saves a schedule", async () => {
    jobs = [job()];
    const user = userEvent.setup();
    render(<JobsSection />);

    await user.click(within(group()).getByRole("switch", { name: "Run on a schedule" }));
    await user.type(within(group()).getByRole("textbox", { name: "Cron expression" }), "0 3 * * *");
    await user.click(within(group()).getByRole("button", { name: "Save schedule" }));

    expect(updateSchedule).toHaveBeenCalledWith({ jobId: "resync_all", enabled: true, cronExpression: "0 3 * * *" });
  });
});
