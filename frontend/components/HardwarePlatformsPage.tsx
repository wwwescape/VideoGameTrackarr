import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { LibraryHardwarePlatform } from "../api/types";
import { useLibraryHardwarePlatforms } from "../hooks/useHardwareLookups";
import { slugify } from "../utils/identifiers";
import { hardwarePlatformLogoUrl } from "../utils/platformLogos";
import CatalogIndexGrid, { type CatalogIndexColumn } from "./CatalogIndexGrid";
import FlatTile from "./FlatTile";
import { LogoOrBadge } from "./PlatformCard";

// Games → Platforms' card for a hardware platform: its logo (or name, until one is added) in a
// short well, then how many devices and accessories it has.
const HardwarePlatformCard = ({ platform, onClick }: { platform: LibraryHardwarePlatform; onClick: () => void }) => {
  const { t } = useTranslation();
  const mode = useTheme().palette.mode;
  return (
    <FlatTile
      name={platform.name}
      onClick={onClick}
      mediaSx={{ aspectRatio: "16 / 9", display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}
      media={<LogoOrBadge logoUrl={hardwarePlatformLogoUrl(platform.name, mode)} badgeText={platform.name} height={56} />}
      lines={[
        t("hardware.platformsPage.deviceCount", { count: platform.deviceCount }),
        t("hardware.platformsPage.accessoryCount", { count: platform.accessoryCount }),
      ]}
    />
  );
};

// Hardware → Platforms: every hardware platform with devices or accessories you own or want,
// each linking to its own page of them (like Games → Platforms).
const HardwarePlatformsPage = () => {
  const { t } = useTranslation();
  const mode = useTheme().palette.mode;
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
    {
      key: "logo",
      label: "",
      hideOnPhone: true,
      render: (entry) => <LogoOrBadge logoUrl={hardwarePlatformLogoUrl(entry.name, mode)} badgeText={entry.name} height={22} />,
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
