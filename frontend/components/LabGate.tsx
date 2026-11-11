import type { ComponentType } from "react";
import { Navigate } from "react-router-dom";
import type { LabId } from "../api/labs";
import { useLabs } from "../hooks/useLabs";

// A page that only exists while its lab is on: nothing until Labs are fetched, and Settings >
// Labs (where it's turned on) while it's off, e.g. an old bookmark to the Game Shelf. It waits
// for a fresh answer, not the persisted one, unless offline (the fetch is paused).
export function withLab<P extends object>(lab: LabId, Page: ComponentType<P>) {
  const Gated = (props: P) => {
    const { data, isError, isFetchedAfterMount, fetchStatus } = useLabs();
    const settled = isFetchedAfterMount || isError || fetchStatus === "paused";
    if (!settled || !data) return null;
    const enabled = data?.some((entry) => entry.id === lab && entry.enabled);
    return enabled ? <Page {...props} /> : <Navigate to="/settings/labs" replace />;
  };
  Gated.displayName = `withLab(${Page.displayName ?? Page.name ?? "Page"})`;
  return Gated;
}
