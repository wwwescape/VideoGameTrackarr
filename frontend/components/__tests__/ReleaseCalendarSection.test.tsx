import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AccessorySummary, DeviceSummary, UpcomingRelease } from "../../api/types";
import { createVgtTheme } from "../../theme/createVgtTheme";
import ReleaseCalendarSection from "../ReleaseCalendarSection";

const device = {
  id: 1,
  uuid: "d1",
  manufacturerName: "Nintendo",
  hardwarePlatformName: "Switch 2",
  officialName: "Nintendo Switch 2 OLED",
  imageUrl: null,
  owned: false,
  wishlisted: true,
  ownedQuantity: 0,
} as DeviceSummary;

const accessory = {
  id: 2,
  uuid: "a1",
  manufacturerName: "Sony",
  accessoryTypeName: "Controller",
  officialName: "DualSense Edge 2",
  imageUrl: null,
  owned: false,
  wishlisted: true,
  ownedQuantity: 0,
} as AccessorySummary;

const releases: UpcomingRelease[] = [
  { kind: "device", device, releaseDate: "2027-03-05", releaseDatePrecision: "day" },
  { kind: "accessory", accessory, releaseDate: "2028-01-01", releaseDatePrecision: "year" },
];

vi.mock("../../hooks/useDashboard", () => ({ useReleaseCalendar: () => ({ data: releases, isLoading: false }) }));

describe("ReleaseCalendarSection", () => {
  it("shows hardware release dates, or just the year when that's all that's known", () => {
    render(
      <ThemeProvider theme={createVgtTheme("light", "normal", "#7c4dff")}>
        <MemoryRouter>
          <ReleaseCalendarSection scope="hardware" title="Hardware Release Calendar" />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByText("Mar 5, 2027")).toBeInTheDocument();
    expect(screen.getByText("2028")).toBeInTheDocument();
    expect(screen.queryByText(/Jan 1, 2028/)).toBeNull();
  });
});
