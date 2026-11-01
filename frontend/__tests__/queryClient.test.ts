import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../queryClient";

describe("createQueryClient", () => {
  it("keeps data fresh for 5 minutes", () => {
    expect(createQueryClient().getDefaultOptions().queries?.staleTime).toBe(5 * 60_000);
  });

  it("marks every query stale after a mutation without refetching it", async () => {
    const client = createQueryClient();
    const platforms = vi.fn(() => Promise.resolve(["ps5"]));
    await client.fetchQuery({ queryKey: ["platforms", "library"], queryFn: platforms });
    expect(client.getQueryState(["platforms", "library"])?.isInvalidated).toBe(false);

    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.resolve("ok") })
      .execute(undefined);

    expect(client.getQueryState(["platforms", "library"])?.isInvalidated).toBe(true);
    expect(platforms).toHaveBeenCalledTimes(1);
  });

  it("leaves data alone when a mutation fails", async () => {
    const client = createQueryClient();
    await client.fetchQuery({ queryKey: ["games"], queryFn: () => Promise.resolve([]) });

    await expect(
      client
        .getMutationCache()
        .build(client, { mutationFn: () => Promise.reject(new Error("nope")) })
        .execute(undefined)
    ).rejects.toThrow("nope");

    expect(client.getQueryState(["games"])?.isInvalidated).toBe(false);
  });
});
