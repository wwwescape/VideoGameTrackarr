import { useState } from "react";
import GridViewIcon from "@mui/icons-material/GridView";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TuneIcon from "@mui/icons-material/Tune";
import Menu from "@mui/material/Menu";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useAccessoriesWithoutOwnedHardware } from "../hooks/useInsights";
import { useLocalPreference } from "../hooks/useLocalPreference";
import { hardwareIdentifier } from "../utils/identifiers";
import { CARD_SIZE_DEFAULT } from "./GameListViews";
import { HardwareListSection, type HardwareListView, type HardwareRow } from "./HardwareListViews";
import { CardSizeSlider, ChoiceMenu } from "./ListControls";
import Page, { ToolbarButton } from "./Page";

// Insights → Orphaned accessories: accessories you own with none of their devices owned, as
// Hardware cards or a table.
const OrphanedAccessoriesPage = () => {
  const { t } = useTranslation();
  const { data: accessories, isLoading } = useAccessoriesWithoutOwnedHardware();
  const [view, setView] = useLocalPreference<HardwareListView>("orphans.view", "cards");
  const [cardSize, setCardSize] = useLocalPreference("orphans.cardSize", CARD_SIZE_DEFAULT);
  const [menu, setMenu] = useState<{ name: "options" | "view"; anchor: HTMLElement } | null>(null);

  // Only owned accessories are listed; the list doesn't carry how many you own.
  const rows: HardwareRow[] | undefined = accessories?.map((accessory) => ({
    id: accessory.id,
    name: accessory.officialName,
    manufacturer: accessory.manufacturerName,
    detail: null,
    imageUrl: accessory.imageUrl,
    owned: true,
    wishlisted: false,
    ownedQuantity: 1,
    href: `/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}`,
  }));

  return (
    <Page
      toolbarEnd={
        <>
          <ToolbarButton
            icon={<TuneIcon />}
            label={t("games.listView.options")}
            onClick={(event) => setMenu({ name: "options", anchor: event.currentTarget })}
            aria-haspopup="menu"
          />
          <ToolbarButton
            icon={view === "table" ? <TableRowsIcon /> : <GridViewIcon />}
            label={t("games.listView.view")}
            onClick={(event) => setMenu({ name: "view", anchor: event.currentTarget })}
            aria-haspopup="menu"
          />
        </>
      }
    >
      <Typography variant="body2" color="text.secondary">
        {t("insights.orphans.description")}
      </Typography>
      <HardwareListSection
        id="accessories"
        title={t("hardware.page.accessoriesHeading")}
        rows={rows}
        isLoading={isLoading}
        emptyMessage={t("hardware.accessoriesWithoutOwnedHardware.empty")}
        detailLabel=""
        view={view}
        cardSize={cardSize}
        compact
      />
      <Menu anchorEl={menu?.anchor} open={menu?.name === "options"} onClose={() => setMenu(null)}>
        <CardSizeSlider value={cardSize} onChange={setCardSize} disabled={view !== "cards"} />
      </Menu>
      <ChoiceMenu<HardwareListView>
        anchor={menu?.name === "view" ? menu.anchor : null}
        onClose={() => setMenu(null)}
        choices={[
          { value: "cards", label: t("catalog.index.viewCards"), icon: <GridViewIcon /> },
          { value: "table", label: t("games.listView.view_table"), icon: <TableRowsIcon /> },
        ]}
        selected={view}
        onSelect={setView}
      />
    </Page>
  );
};

export default OrphanedAccessoriesPage;
