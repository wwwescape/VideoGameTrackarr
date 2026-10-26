import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import SetupAdmin from "../SetupAdmin";

const mutateAsync = vi.fn(async () => undefined);
let error: unknown = null;

vi.mock("../../hooks/useAuth", () => ({
  useSetupAdmin: () => ({ mutateAsync, isPending: false, isError: error !== null, error }),
}));

describe("SetupAdmin", () => {
  it("sends the setup code with the new account", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<SetupAdmin onDone={onDone} />);

    await user.type(screen.getByLabelText(/Setup code/), "  ABCD-EFGH ");
    await user.type(screen.getByLabelText(/^Username/), "admin");
    await user.type(screen.getByLabelText(/^Password/), "a-strong-password");
    await user.type(screen.getByLabelText(/^Confirm password/), "a-strong-password");
    await user.click(screen.getByRole("button", { name: "Create admin account" }));

    expect(mutateAsync).toHaveBeenCalledWith({ username: "admin", password: "a-strong-password", setupCode: "ABCD-EFGH" });
    expect(onDone).toHaveBeenCalled();
  });

  it("says when the setup code is wrong", () => {
    error = new AxiosError("Forbidden", "403", undefined, undefined, {
      status: 403,
      statusText: "Forbidden",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    });
    render(<SetupAdmin onDone={vi.fn()} />);

    expect(screen.getByText(/That setup code isn't right/)).toBeInTheDocument();
  });
});
