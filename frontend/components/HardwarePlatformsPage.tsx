import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { LibraryHardwarePlatform } from "../api/types";
import { useLibraryHardwarePlatforms } from "../hooks/useHardwareLookups";
import { slugify } from "../utils/identifiers";
import CatalogIndexGrid, { type CatalogIndexColumn } from "./CatalogIndexGrid";
import FlatTile from "./FlatTile";

// Product shots per count: one fills the well, two sit side by side, three or four make a 2×2.
const GRID_BY_COUNT: Record<number, { columns: number; rows: number }> = {
  1: { columns: 1, rows: 1 },
  2: { columns: 2, rows: 1 },
  3: { columns: 2, rows: 2 },
  4: { columns: 2, rows: 2 },
};

// HardwareCard's look (product shots whole in a white 4:3 well) for a platform: up to four of
// its devices' and accessories' shots, and how many of each it has.
const HardwarePlatformCard = ({ platform, onClick }: { platform: LibraryHardwarePlatform; onClick: () => void }) => {
  const { t } = useTranslation();
  const images = platform.imageUrls.slice(0, 4);
  const grid = GRID_BY_COUNT[images.length];
  return (
    <FlatTile
      name={platform.name}
      onClick={onClick}
      mediaSx={{ aspectRatio: "4 / 3", bgcolor: grid ? "#fff" : "vgt.surface2" }}
      lines={[
        t("hardware.platformsPage.cardCounts", {
          devices: t("hardware.platformsPage.deviceCount", { count: platform.deviceCount }),
          accessories: t("hardware.platformsPage.accessoryCount", { count: platform.accessoryCount }),
        }),
      ]}
      media={
        grid ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              p: 1,
              display: "grid",
              gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
              gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
              gap: 0.5,
            }}
          >
            {images.map((url) => (
              <Box
                key={url}
                component="img"
                src={resolveAssetUrl(url) ?? undefined}
                alt=""
                loading="lazy"
                sx={{ width: "100%", height: "100%", minHeight: 0, objectFit: "contain", display: "block" }}
              />
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "vgt.text3",
              fontSize: 12,
            }}
          >
            {t("hardware.platformsPage.noImage")}
          </Box>
        )
      }
    />
  );
};

// Hardware → Platforms: every hardware platform with devices or accessories you own or want,
// each linking to its own page of them (like Games → Platforms).
const HardwarePlatformsPage = () => {
  const { t } = useTranslation();
  const { data: platforms, isLoading } = useLibraryHardwarePlatforms();

  const tableColumns: CatalogIndexColumn<LibraryHardwarePlatform>[] = [
    {
      key: "devices",
      label: t("hardware.page.devicesHeading"),
      render: (entry) => entry.deviceCount,
      sortValue: (entry) => entry.deviceCount,
    },
    {
      key: "accessories",
      label: t("hardware.page.accessoriesHeading"),
      render: (entry) => entry.accessoryCount,
      sortValue: (entry) => entry.accessoryCount,
    },
    {
      key: "owned",
      label: t("games.platformsPage.columnOwned"),
      hideOnPhone: true,
      render: (entry) => entry.ownedCount,
      sortValue: (entry) => entry.ownedCount,
    },
    {
      key: "wishlisted",
      label: t("games.platformsPage.columnWishlisted"),
      hideOnPhone: true,
      render: (entry) => entry.wishlistedCount,
      sortValue: (entry) => entry.wishlistedCount,
    },
  ];

  return (
    <CatalogIndexGrid
      stateKey="hardwarePlatforms"
      emptyMessage={t("hardware.platformsPage.emptyMessage")}
      countKey="games.platformsPage.count"
      searchLabel={t("games.platformsPage.searchLabel")}
      searchPlaceholder={t("games.platformsPage.searchPlaceholder")}
      entries={platforms}
      isLoading={isLoading}
      getHref={(entry) => `/hardware/platforms/${slugify(entry.name)}`}
      renderCard={(entry, onClick) => <HardwarePlatformCard platform={entry} onClick={onClick} />}
      tableColumns={tableColumns}
      statusFilter={{
        label: t("catalog.index.filterOwnership"),
        choices: [
          { value: "owned", label: t("catalog.index.filterWithOwned"), matches: (entry) => entry.ownedCount > 0 },
          { value: "wishlisted", label: t("catalog.index.filterWithWishlisted"), matches: (entry) => entry.wishlistedCount > 0 },
        ],
      }}
    />
  );
};

export default HardwarePlatformsPage;
