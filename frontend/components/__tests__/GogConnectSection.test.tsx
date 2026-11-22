import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GogStatus } from "../../api/integrations";
import { createVgtTheme } from "../../theme/createVgtTheme";
import GogConnectSection from "../GogConnectSection";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

const LOGIN_URL = "https://auth.gog.com/auth?client_id=x";
const LANDING = "https://embed.gog.com/on_login_success?origin=client&code=abc123";

let status: GogStatus = { connected: false, username: null, loginUrl: LOGIN_URL };
const connect = vi.fn();
const disconnect = vi.fn();
vi.mock("../../hooks/useIntegrations", () => ({
  useGogStatus: () => ({ data: status }),
  useConnectGog: () => ({ mutateAsync: connect, isPending: false }),
  useDisconnectGog: () => ({ mutateAsync: disconnect, isPending: false }),
}));

function renderSection() {
  return render(
    <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
      <MemoryRouter>
        <GogConnectSection />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("GogConnectSection", () => {
  const popup = { close: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    status = { connected: false, username: null, loginUrl: LOGIN_URL };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  });

  it("opens GOG's sign-in in a popup and shows the steps", () => {
    renderSection();

    expect(screen.getByText("Not connected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to GOG" }));

    expect(window.open).toHaveBeenCalledWith(
      LOGIN_URL,
      "vgt-gog-login",
      expect.stringContaining("popup")
    );
    expect(screen.getByLabelText("Address of the page GOG showed")).toBeInTheDocument();
  });

  it("connects as soon as an address with a code is pasted, then closes the popup", async () => {
    connect.mockResolvedValue({ connected: true, username: "geralt", loginUrl: LOGIN_URL });
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to GOG" }));

    fireEvent.change(screen.getByLabelText("Address of the page GOG showed"), {
      target: { value: LANDING },
    });

    await waitFor(() => expect(connect).toHaveBeenCalledWith(LANDING));
    await waitFor(() => expect(popup.close).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Connected to GOG as geralt.", expect.anything());
  });

  it("waits for the Connect button when the paste has no code in it", async () => {
    connect.mockResolvedValue({ connected: true, username: null, loginUrl: LOGIN_URL });
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to GOG" }));

    fireEvent.change(screen.getByLabelText("Address of the page GOG showed"), {
      target: { value: "abc123" },
    });
    expect(connect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(connect).toHaveBeenCalledWith("abc123"));
  });

  it("explains a rejected sign-in and keeps the popup open", async () => {
    connect.mockRejectedValue(
      new AxiosError("bad", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 422,
        statusText: "Unprocessable",
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      })
    );
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to GOG" }));

    fireEvent.change(screen.getByLabelText("Address of the page GOG showed"), {
      target: { value: LANDING },
    });

    expect(await screen.findByText(/GOG didn't accept that sign-in/)).toBeInTheDocument();
    expect(popup.close).not.toHaveBeenCalled();
  });

  it("shows who is connected and disconnects after confirming", async () => {
    status = { connected: true, username: "geralt", loginUrl: LOGIN_URL };
    disconnect.mockResolvedValue({ connected: false, username: null, loginUrl: LOGIN_URL });
    renderSection();

    expect(screen.getByText("Connected as geralt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in to GOG" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Disconnect" }).at(-1)!);

    await waitFor(() => expect(disconnect).toHaveBeenCalled());
  });
});
