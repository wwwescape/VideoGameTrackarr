import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import Box from "@mui/material/Box";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import Tooltip from "@mui/material/Tooltip";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentKind } from "../api/types";
import CheatIcon from "../icons/CheatIcon";
import GuideIcon from "../icons/GuideIcon";

// Each document type's icon and colour, shared by the rows, the Add dialog and the reader.
export const DOCUMENT_KIND_ICONS: Record<DocumentKind, ComponentType<SvgIconProps>> = {
  guide: GuideIcon,
  cheat: CheatIcon,
  manual: MenuBookOutlinedIcon,
  quick_start: RocketLaunchOutlinedIcon,
  receipt: ReceiptLongOutlinedIcon,
  warranty: VerifiedUserOutlinedIcon,
  repair: HandymanOutlinedIcon,
  other: DescriptionOutlinedIcon,
};

export const DOCUMENT_KIND_COLORS: Record<DocumentKind, string> = {
  guide: "primary.main",
  cheat: "secondary.main",
  manual: "primary.main",
  quick_start: "primary.main",
  receipt: "success.main",
  warranty: "info.main",
  repair: "warning.main",
  other: "text.secondary",
};

// The type tile at the start of a row.
export const DocumentKindTile = ({ kind }: { kind: DocumentKind }) => {
  const { t } = useTranslation();
  const label = t(`guides.kind.${kind}`);
  const Icon = DOCUMENT_KIND_ICONS[kind];
  return (
    <Tooltip title={label}>
      <Box
        role="img"
        aria-label={label}
        sx={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "vgt.surface2",
          color: DOCUMENT_KIND_COLORS[kind],
        }}
      >
        <Icon fontSize="small" />
      </Box>
    </Tooltip>
  );
};
