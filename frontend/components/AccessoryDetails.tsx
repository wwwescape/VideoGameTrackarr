import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditIcon from "@mui/icons-material/Edit";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "./ConfirmDialog";
import NotesSection from "./NotesSection";
import NotFoundPage from "./NotFoundPage";
import TagsSection from "./TagsSection";
import { useAccessoryItem, useDeleteAccessory } from "../hooks/useAccessories";
import {
  useCreateAccessoryNote,
  useDeleteAccessoryNote,
  useAccessoryNotes,
  useUpdateAccessoryNote,
} from "../hooks/useAccessoryNotes";
import { useAttachAccessoryTag, useDetachAccessoryTag } from "../hooks/useTags";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { useUserAccessoryList } from "../hooks/useUserAccessories";
import { CONDITION_LABELS, RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { useCanonicalAddress, useDetailBack, editFromDetail } from "../utils/navState";
import { DetailColumns, Facts, Panel, Pill, Section } from "./Detail";
import { HardwareHero, LinkedHardware } from "./HardwareDetailParts";
import Page, { ToolbarButton, ToolbarDivider, useRouteCrumbs } from "./Page";

const AccessoryDetails = () => {
  const { t } = useTranslation();
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();

  const { data: accessory, isLoading, isError } = useAccessoryItem(identifier);
  const accessoryId = accessory?.id ?? NaN;
  const { currency } = useCurrency();
  const deleteAccessory = useDeleteAccessory();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const routeCrumbs = useRouteCrumbs();
  const { back, toList } = useDetailBack("/hardware");
  // The address includes the name; correct it in place after a rename.
  useCanonicalAddress(accessory ? `/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}` : null);

  const { data: ownershipRows } = useUserAccessoryList(accessoryId);

  const attachTag = useAttachAccessoryTag(accessoryId);
  const detachTag = useDetachAccessoryTag(accessoryId);

  const { data: accessoryNotes } = useAccessoryNotes(accessoryId);
  const createNote = useCreateAccessoryNote(accessoryId);
  const updateNote = useUpdateAccessoryNote(accessoryId);
  const deleteNote = useDeleteAccessoryNote(accessoryId);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.accessoryNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.hardware") })}
        actionTo="/hardware"
      />
    );
  }

  if (isLoading || !accessory) {
    return (
      <Page>
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      </Page>
    );
  }

  // An accessory can technically have multiple owned/wishlisted UserAccessory rows, but Add
  // Accessory always creates exactly one alongside the catalog row — this page shows that one
  // record rather than a list, preferring an owned copy over a wishlisted one if both exist.
  const primaryOwnership = ownershipRows?.find((row) => row.status === "owned") ?? ownershipRows?.[0] ?? null;
  const isCustom = !accessory.hardwareReference;
  const releaseDate = accessory.releaseDate ?? accessory.hardwareReference?.releaseDate ?? null;
  const summaryText = accessory.hardwareReference?.summary ?? accessory.summary;

  const handleDelete = async () => {
    try {
      await deleteAccessory.mutateAsync(accessoryId);
      toast.success(t("hardware.accessoryDetails.removeSuccess"), TOAST_OPTIONS);
      navigate("/hardware", { replace: true });
    } catch (error) {
      console.error("Error deleting accessory:", error);
      toast.error(t("hardware.accessoryDetails.removeError"), TOAST_OPTIONS);
    }
  };

  return (
    <Page
      crumbs={[]}
      toolbar={
        <>
          <ToolbarButton icon={<ArrowBackIcon />} label={toList ? t("nav.hardware") : t("detail.back")} onClick={back} />
          <ToolbarDivider />
          <ToolbarButton
            icon={<EditIcon />}
            label={t("hardware.accessoryDetails.editButton")}
            onClick={() =>
              navigate(`/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}/edit`, { state: editFromDetail })
            }
          />
          <Box sx={{ flexGrow: 1 }} />
          <ToolbarButton
            danger
            icon={<DeleteOutlineIcon />}
            label={t("hardware.accessoryDetails.removeButton")}
            onClick={() => setDeleteConfirmOpen(true)}
          />
        </>
      }
      hero={
        <HardwareHero
          name={accessory.officialName}
          imageUrl={accessory.imageUrl}
          owned={accessory.owned}
          wishlisted={accessory.wishlisted}
          crumbs={routeCrumbs.slice(0, -1)}
          subline={[accessory.manufacturerName, accessory.accessoryTypeName, releaseDate]}
          pills={
            <>
              {accessory.owned ? (
                <Pill tone="owned" icon={<CheckIcon />}>
                  {t("hardware.detailsShared.statusOwned")}
                </Pill>
              ) : null}
              {accessory.wishlisted ? <Pill icon={<FavoriteIcon />}>{t("hardware.detailsShared.statusWishlist")}</Pill> : null}
              {primaryOwnership?.condition ? <Pill>{CONDITION_LABELS[primaryOwnership.condition]}</Pill> : null}
              {accessory.ratingBoard ? <Pill>{RATING_BOARD_LABELS[accessory.ratingBoard]}</Pill> : null}
              {isCustom ? (
                <Pill title={t("hardware.accessoryDetails.customTooltip")}>{t("hardware.accessoryDetails.customLabel")}</Pill>
              ) : null}
            </>
          }
        />
      }
    >
      <DetailColumns
        main={
          <>
            {summaryText ? (
              <Section id="about" title={t("games.detail.aboutTitle")}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", maxWidth: 900 }}>
                  {summaryText}
                </Typography>
              </Section>
            ) : null}
            <Section id="details" title={t("detail.detailsTitle")}>
              <Facts
                facts={[
              [t("hardware.detailsShared.brandLabel"), accessory.manufacturerName],
              [t("hardware.detailsShared.modelNumberLabel"), accessory.model],
              [t("hardware.detailsShared.serialNumberLabel"), primaryOwnership?.serialNumber],
              [t("hardware.detailsShared.colorLabel"), accessory.colorName],
              [t("hardware.detailsShared.revisionLabel"), accessory.revision],
              [
                t("hardware.detailsShared.ratingsBoardLabel"),
                accessory.ratingBoard ? RATING_BOARD_LABELS[accessory.ratingBoard] : null,
              ],
              [
                t("hardware.detailsShared.priceTitle"),
                primaryOwnership?.purchasePrice != null
                  ? formatCurrency(primaryOwnership.purchasePrice, currency)
                  : t("hardware.detailsShared.priceNotSet"),
              ],
              [
                t("hardware.detailsShared.statusLabel"),
                primaryOwnership
                  ? primaryOwnership.status === "owned"
                    ? t("hardware.detailsShared.statusOwned")
                    : t("hardware.detailsShared.statusWishlist")
                  : null,
              ],
              [
                t("hardware.detailsShared.conditionLabel"),
                primaryOwnership?.condition ? CONDITION_LABELS[primaryOwnership.condition] : null,
              ],
                ]}
              />
              {!primaryOwnership ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  {t("hardware.detailsShared.inventoryNotTracked")}
                </Typography>
              ) : null}
            </Section>
            <Section id="linked-devices" title={t("hardware.accessoryDetails.linkedDevicesTitle")}>
              <LinkedHardware
                items={accessory.linkedDevices.map((linked) => ({
                  key: linked.id,
                  label: linked.officialName,
                  to: `/hardware/device/${hardwareIdentifier(linked.officialName, linked.uuid)}`,
                }))}
                emptyText={t("hardware.accessoryDetails.noLinkedDevices")}
              />
            </Section>
            <Section id="linked" title={t("hardware.detailsShared.linkedAccessoriesTitle")}>
              <LinkedHardware
                items={accessory.linkedAccessories.map((linked) => ({
                  key: linked.id,
                  label: linked.officialName,
                  to: `/hardware/accessory/${hardwareIdentifier(linked.officialName, linked.uuid)}`,
                }))}
                emptyText={t("hardware.accessoryDetails.noLinkedAccessories")}
              />
            </Section>
          </>
        }
        side={
          <>
            <Section id="tags" title={t("tags.title")}>
              <Panel>
                <TagsSection
                  tags={accessory.tags}
                  onAttach={(tagId) => attachTag.mutateAsync(tagId)}
                  onDetach={(tagId) => detachTag.mutateAsync(tagId)}
                  subheader={t("hardware.detailsShared.tagsSubheader")}
                  inSection
                />
              </Panel>
            </Section>
            <Section id="notes" title={t("notes.title")}>
              <Panel>
                <NotesSection
                  notes={accessoryNotes}
                  isCreating={createNote.isPending}
                  subheader={t("hardware.detailsShared.notesSubheader")}
                  onCreate={(body) => createNote.mutateAsync(body)}
                  onUpdate={(noteId, body) => updateNote.mutateAsync({ noteId, body })}
                  onDelete={(noteId) => deleteNote.mutateAsync(noteId)}
                  inSection
                />
              </Panel>
            </Section>
          </>
        }
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t("hardware.accessoryDetails.deleteConfirmTitle")}
        description={t("hardware.accessoryDetails.deleteConfirmDescription", { name: accessory.officialName })}
        confirmLabel={t("common.delete")}
        confirmColor="error"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </Page>
  );
};

export default AccessoryDetails;
