import { useQueryClient } from "@tanstack/react-query";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { deleteLibraryItem } from "../api/library";
import type { LibraryItem } from "../api/types";
import { useDuplicateLibraryItems } from "../hooks/useInsights";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { gameIdentifier } from "../utils/identifiers";
import { Panel, Section } from "./Detail";
import { showUndoToast } from "./UndoToast";
import VirtualList from "./VirtualList";

const DuplicateLibraryItemsSection = () => {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<string, string> = {
    owned: t("insights.duplicates.statusOwned"),
    wishlist: t("insights.duplicates.statusWishlist"),
  };
  const { data: groups } = useDuplicateLibraryItems();
  const queryClient = useQueryClient();

  const { schedule, isPending } = useUndoableAction<LibraryItem>({
    getId: (item) => item.id,
    onCommit: async (items) => {
      await Promise.all(items.map((item) => deleteLibraryItem(item.id)));
      queryClient.invalidateQueries({ queryKey: ["insights", "duplicate-library-items"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });

  const handleDelete = (item: LibraryItem) => {
    const { undo } = schedule([item]);
    showUndoToast(t("insights.duplicates.removedToast"), undo, 5000);
  };

  const visibleGroups = (groups ?? [])
    .map((group) => ({ ...group, items: group.items.filter((item) => !isPending(item.id)) }))
    .filter((group) => group.items.length > 1);

  if (visibleGroups.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("insights.duplicates.noneFound")}
      </Typography>
    );
  }

  return (
    <VirtualList
      items={visibleGroups}
      getKey={(group) => group.gameId}
      estimateSize={() => 160}
      gap={0}
      renderItem={(group) => (
        <Section
          title={group.gameName}
          action={
            <Box
              component={Link}
              to={`/game/${gameIdentifier({ slug: group.gameSlug, uuid: group.gameUuid, name: group.gameName })}#library`}
              sx={{ fontSize: 12.5, fontWeight: 600, color: "primary.main", textDecoration: "none", whiteSpace: "nowrap" }}
            >
              {t("insights.missingAddons.openGame")}
            </Box>
          }
        >
          <Panel>
            {group.items.map((item, index) => (
              <Stack
                key={item.id}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", px: 2, py: 1, borderTop: index ? 1 : 0, borderColor: "divider" }}
              >
                <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {STATUS_LABEL[item.status]}
                  </Box>
                  <Box component="span" sx={{ color: "text.secondary" }}>
                    {" · "}
                    {item.platformName ?? t("insights.duplicates.anyPlatform")} ·{" "}
                    {item.regionName ?? t("insights.duplicates.anyRegion")}
                    {item.edition ? ` · ${item.edition}` : ""}
                  </Box>
                </Typography>
                <Tooltip title={t("insights.duplicates.removeEntryTooltip")}>
                  <IconButton size="small" onClick={() => handleDelete(item)} aria-label={t("insights.duplicates.removeEntryTooltip")}>
                    <DeleteOutlineOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Panel>
        </Section>
      )}
    />
  );
};

export default DuplicateLibraryItemsSection;
