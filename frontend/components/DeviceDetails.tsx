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
import { useDeleteDevice, useDeviceItem } from "../hooks/useDevice";
import {
  useCreateDeviceNote,
  useDeleteDeviceNote,
  useDeviceNotes,
  useUpdateDeviceNote,
} from "../hooks/useDeviceNotes";
import { useAttachDeviceTag, useDetachDeviceTag } from "../hooks/useTags";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { useUserDeviceList } from "../hooks/useUserDevice";
import { CONDITION_LABELS, RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { useCanonicalAddress, useDetailBack, editFromDetail } from "../utils/navState";
import { DetailColumns, Facts, Pill, Section } from "./Detail";
import { HardwareHero, LinkedHardware } from "./HardwareDetailParts";
import Page, { ToolbarButton, ToolbarDivider, useRouteCrumbs } from "./Page";

const DeviceDetails = () => {
  const { t } = useTranslation();
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();

  const { data: device, isLoading, isError } = useDeviceItem(identifier);
  const deviceId = device?.id ?? NaN;
  const { currency } = useCurrency();
  const deleteDevice = useDeleteDevice();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const routeCrumbs = useRouteCrumbs();
  const { back, toList } = useDetailBack("/hardware");
  // The address includes the name; correct it in place after a rename.
  useCanonicalAddress(device ? `/hardware/device/${hardwareIdentifier(device.officialName, device.uuid)}` : null);

  const { data: ownershipRows } = useUserDeviceList(deviceId);

  const attachTag = useAttachDeviceTag(deviceId);
  const detachTag = useDetachDeviceTag(deviceId);

  const { data: deviceNotes } = useDeviceNotes(deviceId);
  const createNote = useCreateDeviceNote(deviceId);
  const updateNote = useUpdateDeviceNote(deviceId);
  const deleteNote = useDeleteDeviceNote(deviceId);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.deviceNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.hardware") })}
        actionTo="/hardware"
      />
    );
  }

  if (isLoading || !device) {
    return (
      <Page>
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      </Page>
    );
  }

  // A device can technically have multiple owned/wishlisted UserDevice rows, but Add Device
  // always creates exactly one alongside the catalog row — this page shows that one record
  // rather than a list, preferring an owned copy over a wishlisted one if both exist.
  const primaryOwnership = ownershipRows?.find((row) => row.status === "owned") ?? ownershipRows?.[0] ?? null;

  const handleDelete = async () => {
    try {
      await deleteDevice.mutateAsync(deviceId);
      toast.success(t("hardware.deviceDetails.removeSuccess"), TOAST_OPTIONS);
      navigate("/hardware", { replace: true });
    } catch (error) {
      console.error("Error deleting device:", error);
      toast.error(t("hardware.deviceDetails.removeError"), TOAST_OPTIONS);
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
            label={t("hardware.deviceDetails.editButton")}
            onClick={() =>
              navigate(`/hardware/device/${hardwareIdentifier(device.officialName, device.uuid)}/edit`, { state: editFromDetail })
            }
          />
          <Box sx={{ flexGrow: 1 }} />
          <ToolbarButton
            danger
            icon={<DeleteOutlineIcon />}
            label={t("hardware.deviceDetails.removeButton")}
            onClick={() => setDeleteConfirmOpen(true)}
          />
        </>
      }
      hero={
        <HardwareHero
          name={device.officialName}
          imageUrl={device.imageUrl}
          owned={device.owned}
          wishlisted={device.wishlisted}
          crumbs={routeCrumbs.slice(0, -1)}
          subline={[device.manufacturerName, device.hardwarePlatformName, device.hardwareReference?.artefact, device.hardwareReference?.releaseDate]}
          pills={
            <>
              {device.owned ? (
                <Pill tone="owned" icon={<CheckIcon />}>
                  {t("hardware.detailsShared.statusOwned")}
                </Pill>
              ) : null}
              {device.wishlisted ? <Pill tone="wishlist" icon={<FavoriteIcon />}>{t("hardware.detailsShared.statusWishlist")}</Pill> : null}
              {primaryOwnership?.condition ? <Pill>{CONDITION_LABELS[primaryOwnership.condition]}</Pill> : null}
              {device.ratingBoard ? <Pill>{RATING_BOARD_LABELS[device.ratingBoard]}</Pill> : null}
            </>
          }
        />
      }
    >
      <DetailColumns
        main={
          <>
            {device.hardwareReference?.summary ? (
              <Section id="about" title={t("games.detail.aboutTitle")}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", maxWidth: 900 }}>
                  {device.hardwareReference?.summary}
                </Typography>
              </Section>
            ) : null}
            <Section id="details" title={t("detail.detailsTitle")}>
              <Facts
                facts={[
              [t("hardware.detailsShared.brandLabel"), device.manufacturerName],
              [t("hardware.deviceDetails.consoleLabel"), device.hardwarePlatformName],
              [t("hardware.deviceDetails.variantLabel"), device.hardwareReference?.artefact],
              [t("hardware.detailsShared.modelNumberLabel"), device.model],
              [t("hardware.detailsShared.serialNumberLabel"), primaryOwnership?.serialNumber],
              [t("hardware.detailsShared.colorLabel"), device.colorName],
              [t("hardware.deviceDetails.storageLabel"), device.storageVariantName],
              [t("hardware.detailsShared.revisionLabel"), device.revision],
              [
                t("hardware.detailsShared.ratingsBoardLabel"),
                device.ratingBoard ? RATING_BOARD_LABELS[device.ratingBoard] : null,
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
            <Section id="linked" title={t("hardware.detailsShared.linkedAccessoriesTitle")}>
              <LinkedHardware
                items={device.linkedAccessories.map((linked) => ({
                  key: linked.id,
                  label: linked.officialName,
                  to: `/hardware/accessory/${hardwareIdentifier(linked.officialName, linked.uuid)}`,
                }))}
                emptyText={t("hardware.deviceDetails.noLinkedAccessories")}
              />
            </Section>
          </>
        }
        side={
          <>
            <TagsSection
              tags={device.tags}
              onAttach={(tagId) => attachTag.mutateAsync(tagId)}
              onDetach={(tagId) => detachTag.mutateAsync(tagId)}
            />
            <NotesSection
              notes={deviceNotes}
              isCreating={createNote.isPending}
              onCreate={(body) => createNote.mutateAsync(body)}
              onUpdate={(noteId, body) => updateNote.mutateAsync({ noteId, body })}
              onDelete={(noteId) => deleteNote.mutateAsync(noteId)}
            />
          </>
        }
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t("hardware.deviceDetails.deleteConfirmTitle")}
        description={t("hardware.deviceDetails.deleteConfirmDescription", { name: device.officialName })}
        confirmLabel={t("common.delete")}
        confirmColor="error"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        busy={deleteDevice.isPending}
      />
    </Page>
  );
};

export default DeviceDetails;
