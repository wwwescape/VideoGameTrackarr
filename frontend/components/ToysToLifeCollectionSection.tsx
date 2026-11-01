import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { LibraryStatus, ToysToLifeCopy } from "../api/types";
import { useCreateToysToLifeCopy, useDeleteToysToLifeCopy, useUpdateToysToLifeCopy } from "../hooks/useToysToLife";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency, getCurrencySymbol } from "../utils/currency";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { EmptyLine, ListRow, Panel, Pill, RowAction, Section, SectionAction } from "./Detail";
import { showUndoToast } from "./UndoToast";

interface CopyDialogProps {
  open: boolean;
  status: LibraryStatus;
  copy: ToysToLifeCopy | null;
  busy: boolean;
  onClose: () => void;
  onSave: (price: number | null, notes: string | null) => void;
}

// Adding or editing a copy: just what a pack copy has, its price and notes.
const CopyDialog = ({ open, status, copy, busy, onClose, onSave }: CopyDialogProps) => {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!open) return;
    setPrice(copy?.price != null ? String(copy.price) : "");
    setNotes(copy?.notes ?? "");
  }, [open, copy]);

  const parsedPrice = price.trim() === "" ? null : Number(price);
  const priceInvalid = parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0);
  const where = status === "owned" ? "collection" : "wishlist";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t(copy ? `toysToLife.collection.editTitle_${where}` : `toysToLife.collection.addTitle_${where}`)}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          autoFocus
          type="number"
          margin="dense"
          label={t("toysToLife.collection.priceLabel")}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          error={priceInvalid}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start">{getCurrencySymbol(currency)}</InputAdornment> },
            htmlInput: { min: 0, step: "0.01" },
          }}
        />
        <TextField
          fullWidth
          multiline
          minRows={3}
          margin="normal"
          label={t("toysToLife.collection.notesLabel")}
          placeholder={t("toysToLife.collection.notesPlaceholder")}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          disabled={busy || priceInvalid}
          onClick={() => onSave(parsedPrice, notes.trim() || null)}
        >
          {copy ? t("toysToLife.collection.save") : t("toysToLife.collection.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// A pack page's Your Collection, after Your Rating: your copies of the pack, owned and
// wishlisted, like a game's Your Library. Each row has its Owned/Wishlist chip first, then its
// price and notes, with Move and Remove at the end; clicking a row edits it.
const ToysToLifeCollectionSection = ({ itemId, copies }: { itemId: number; copies: ToysToLifeCopy[] }) => {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const createCopy = useCreateToysToLifeCopy(itemId);
  const updateCopy = useUpdateToysToLifeCopy();
  const deleteCopy = useDeleteToysToLifeCopy();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<{ status: LibraryStatus; copy: ToysToLifeCopy | null } | null>(null);

  const phrase = (status: LibraryStatus) =>
    status === "owned" ? t("games.library.collectionPhrase") : t("games.library.wishlistPhrase");

  const { schedule, isPending } = useUndoableAction<ToysToLifeCopy>({
    getId: (copy) => copy.id,
    onCommit: async (removed) => {
      await Promise.all(removed.map((copy) => deleteCopy.mutateAsync(copy.id)));
    },
  });

  // Owned copies first, then the wishlist, as on a game's Your Library.
  const visible = copies
    .filter((copy) => !isPending(copy.id))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "owned" ? -1 : 1));

  const openAdd = (status: LibraryStatus) => {
    setMenuAnchor(null);
    setDialog({ status, copy: null });
  };

  const save = async (price: number | null, notes: string | null) => {
    if (!dialog) return;
    try {
      if (dialog.copy) {
        await updateCopy.mutateAsync({ copyId: dialog.copy.id, input: { price, notes } });
        toast.success(t("toysToLife.collection.updatedToast", { phrase: phrase(dialog.status) }), TOAST_OPTIONS);
      } else {
        await createCopy.mutateAsync({ status: dialog.status, price, notes });
        toast.success(t("toysToLife.collection.addedToast", { phrase: phrase(dialog.status) }), TOAST_OPTIONS);
      }
      setDialog(null);
    } catch (error) {
      console.error("Error saving a Toys-to-Life copy:", error);
      toast.error(t("toysToLife.collection.saveErrorToast"), TOAST_OPTIONS);
    }
  };

  const move = async (copy: ToysToLifeCopy) => {
    const status: LibraryStatus = copy.status === "owned" ? "wishlist" : "owned";
    try {
      await updateCopy.mutateAsync({ copyId: copy.id, input: { status } });
      toast.success(t("toysToLife.collection.movedToast", { phrase: phrase(status) }), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error moving a Toys-to-Life copy:", error);
      toast.error(t("toysToLife.collection.saveErrorToast"), TOAST_OPTIONS);
    }
  };

  const remove = (copy: ToysToLifeCopy) => {
    const { undo } = schedule([copy]);
    showUndoToast(t("toysToLife.collection.removedToast", { phrase: phrase(copy.status) }), undo, 5000);
  };

  return (
    <>
      <Section
        id="collection"
        title={t("toysToLife.collection.title")}
        action={
          <SectionAction
            icon={<AddIcon />}
            label={t("toysToLife.collection.addPack")}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            aria-haspopup="menu"
          />
        }
      >
        <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => openAdd("owned")}>
            <ListItemIcon>
              <CheckIcon fontSize="small" />
            </ListItemIcon>
            {t("games.library.addToCollection")}
          </MenuItem>
          <MenuItem onClick={() => openAdd("wishlist")}>
            <ListItemIcon>
              <FavoriteIcon fontSize="small" />
            </ListItemIcon>
            {t("games.library.addToWishlist")}
          </MenuItem>
        </Menu>
        {visible.length === 0 ? (
          <EmptyLine>{t("toysToLife.collection.empty")}</EmptyLine>
        ) : (
          <Panel>
            {visible.map((copy) => {
              const owned = copy.status === "owned";
              const priceText = copy.price != null ? formatCurrency(copy.price, currency) : t("toysToLife.collection.noPrice");
              return (
                <ListRow
                  key={copy.id}
                  label={`${owned ? t("games.library.ownedChip") : t("games.library.wishlistChip")} · ${priceText}`}
                  onClick={() => setDialog({ status: copy.status, copy })}
                  leading={
                    <Pill small tone={owned ? "owned" : "wishlist"} icon={owned ? <CheckIcon /> : <FavoriteIcon />}>
                      {owned ? t("games.library.ownedChip") : t("games.library.wishlistChip")}
                    </Pill>
                  }
                  title={
                    <Box component="span" sx={{ color: copy.price != null ? "text.primary" : "text.secondary", fontWeight: copy.price != null ? 600 : 400 }}>
                      {priceText}
                    </Box>
                  }
                  subtitle={copy.notes ? <Box component="span" sx={{ whiteSpace: "pre-line" }}>{copy.notes}</Box> : undefined}
                  actions={
                    <>
                      <RowAction
                        title={owned ? t("table.moveToWishlist") : t("table.moveToCollection")}
                        icon={owned ? <FavoriteBorderIcon fontSize="small" /> : <CheckIcon fontSize="small" />}
                        onClick={() => void move(copy)}
                      />
                      <RowAction
                        title={t("common.remove")}
                        icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                        onClick={() => remove(copy)}
                      />
                    </>
                  }
                />
              );
            })}
          </Panel>
        )}
      </Section>
      <CopyDialog
        open={dialog !== null}
        status={dialog?.status ?? "owned"}
        copy={dialog?.copy ?? null}
        busy={createCopy.isPending || updateCopy.isPending}
        onClose={() => setDialog(null)}
        onSave={(price, notes) => void save(price, notes)}
      />
    </>
  );
};

export default ToysToLifeCollectionSection;
