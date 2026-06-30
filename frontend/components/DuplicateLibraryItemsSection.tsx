import { useQueryClient } from "@tanstack/react-query";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";
import { deleteLibraryItem } from "../api/library";
import type { LibraryItem } from "../api/types";
import { useDuplicateLibraryItems } from "../hooks/useInsights";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { gameIdentifier } from "../utils/identifiers";
import { showUndoToast } from "./UndoToast";
import VirtualList from "./VirtualList";

const STATUS_LABEL: Record<string, string> = { owned: "Owned", wishlist: "Wishlist" };

const DuplicateLibraryItemsSection = () => {
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
    showUndoToast("Duplicate entry removed", undo, 5000);
  };

  const visibleGroups = (groups ?? [])
    .map((group) => ({ ...group, items: group.items.filter((item) => !isPending(item.id)) }))
    .filter((group) => group.items.length > 1);

  if (visibleGroups.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No duplicate library entries found.
      </Typography>
    );
  }

  return (
    <VirtualList
      items={visibleGroups}
      getKey={(group) => group.gameId}
      estimateSize={() => 140}
      gap={16}
      renderItem={(group) => (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            <Link
              to={`/game/${gameIdentifier({ slug: group.gameSlug, uuid: group.gameUuid, name: group.gameName })}#library`}
            >
              {group.gameName}
            </Link>
          </Typography>
          <Stack spacing={1}>
            {group.items.map((item) => (
              <Stack key={item.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {STATUS_LABEL[item.status]} · {item.platformName ?? "Any platform"} ·{" "}
                  {item.regionName ?? "Any region"}
                  {item.edition ? ` · ${item.edition}` : ""}
                </Typography>
                <Tooltip title="Remove this entry">
                  <IconButton size="small" onClick={() => handleDelete(item)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    />
  );
};

export default DuplicateLibraryItemsSection;
