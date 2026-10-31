import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "../../api/types";
import ConnectorsSection from "../ConnectorsSection";

const connector = (overrides: Partial<Connector>): Connector => ({
  id: 1,
  name: "Nintendo Switch",
  slug: "switch",
  kind: "nx_remote_launcher",
  platformId: null,
  mediaFormat: null,
  digitalStorefront: null,
  wishlist: false,
  absentMode: "note",
  lastSyncAt: null,
  lastSyncResult: null,
  devices: [],
  signedIn: false,
  presentCount: 0,
  absentCount: 0,
  ...overrides,
});

const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };

vi.mock("../../hooks/useConnectors", () => ({
  useConnectors: () => ({
    data: [connector({}), connector({ id: 2, name: "Steam Deck", slug: "steam-deck", kind: "custom" })],
  }),
  useCreateConnector: () => mutation,
  useUpdateConnector: () => mutation,
  useDeleteConnector: () => mutation,
  useRevokeConnectorDevice: () => mutation,
  useSignInConnector: () => mutation,
  useSyncStoreConnectors: () => mutation,
  useImportConnectorGames: () => mutation,
}));
vi.mock("../ConnectorDialog", () => ({ default: () => null, CONNECTOR_KINDS: [] }));

describe("ConnectorsSection", () => {
  it("marks the Nintendo Switch connector as built in, with no delete button", () => {
    render(<ConnectorsSection />);

    expect(screen.getByText("Built in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete nintendo switch/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete steam deck/i })).toBeInTheDocument();
  });
});
