import { useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import RedeemIcon from "@mui/icons-material/Redeem";
import RedeemOutlinedIcon from "@mui/icons-material/RedeemOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import type { AddonRelation } from "../api/addonLinks";

// How an add-on goes with a game, everywhere it can be chosen: the link picker's toggle, the
// relation button on Linked add-ons / Linked games / Settings rows, and the picker's chip on a
// row that's already linked. Works with (link), Included (box: owning the game owns the add-on)
// or Pre-order bonus (redeem: a label only).

export const RELATIONS: AddonRelation[] = ["works_with", "included", "preorder_bonus"];

const LABEL_KEYS: Record<AddonRelation, string> = {
  works_with: "games.addonLinks.worksWithOption",
  included: "games.addonLinks.includedOption",
  preorder_bonus: "games.addonLinks.preorderBonusOption",
};

export const relationLabelKey = (relation: AddonRelation) => LABEL_KEYS[relation];

// Outlined in the pickers' toggles and menus, filled where it marks a row's current relation.
export const RelationIcon = ({
  relation,
  filled = false,
}: {
  relation: AddonRelation;
  filled?: boolean;
}) => {
  if (relation === "included") {
    return filled ? (
      <Inventory2Icon fontSize="small" />
    ) : (
      <Inventory2OutlinedIcon fontSize="small" />
    );
  }
  if (relation === "preorder_bonus") {
    return filled ? <RedeemIcon fontSize="small" /> : <RedeemOutlinedIcon fontSize="small" />;
  }
  return <LinkIcon fontSize="small" />;
};

// The picker's choice for a ticked row.
export const RelationToggle = ({
  value,
  onChange,
  disabled,
  label,
}: {
  value: AddonRelation;
  onChange: (relation: AddonRelation) => void;
  disabled?: boolean;
  label: string;
}) => {
  const { t } = useTranslation();
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      disabled={disabled}
      onChange={(_event, next: AddonRelation | null) => {
        if (next) onChange(next);
      }}
      aria-label={label}
    >
      {RELATIONS.map((relation) => (
        <ToggleButton
          key={relation}
          value={relation}
          aria-label={t(LABEL_KEYS[relation])}
          sx={{ gap: 0.5, px: 1, py: 0.25 }}
        >
          <RelationIcon relation={relation} />
          {/* Icons only on a phone, where the three labels don't fit beside the name. */}
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            {t(LABEL_KEYS[relation])}
          </Box>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

const ALREADY_KEYS: Record<AddonRelation, string> = {
  works_with: "games.addonLinks.alreadyLinked",
  included: "games.addonLinks.alreadyIncluded",
  preorder_bonus: "games.addonLinks.alreadyPreorderBonus",
};

// An already-linked picker row's relation, in place of the toggle.
export const RelationChip = ({ relation }: { relation: AddonRelation }) => {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      icon={<RelationIcon relation={relation} />}
      label={t(ALREADY_KEYS[relation])}
    />
  );
};

// A linked row's relation: shows the current one (filled, coloured unless Works with) and opens
// a menu of all three.
export const RelationButton = ({
  value,
  onChange,
  disabled,
  addon,
  game,
}: {
  value: AddonRelation;
  onChange: (relation: AddonRelation) => void;
  disabled?: boolean;
  // Names for the tooltip and the accessible label.
  addon: string;
  game: string;
}) => {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = t(LABEL_KEYS[value]);
  return (
    <>
      <Tooltip title={t("games.addonLinks.relationTooltip", { addon, game, relation: current })}>
        <IconButton
          size="small"
          color={value === "works_with" ? "default" : "primary"}
          aria-label={t("games.addonLinks.relationButtonLabel", { addon, game, relation: current })}
          aria-haspopup="menu"
          disabled={disabled}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <RelationIcon relation={value} filled />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {RELATIONS.map((relation) => (
          <MenuItem
            key={relation}
            selected={relation === value}
            onClick={() => {
              setAnchor(null);
              if (relation !== value) onChange(relation);
            }}
          >
            <ListItemIcon>
              <RelationIcon relation={relation} />
            </ListItemIcon>
            <ListItemText>{t(LABEL_KEYS[relation])}</ListItemText>
            {relation === value ? <CheckIcon fontSize="small" sx={{ ml: 2 }} /> : null}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

// Where a manual link's unlink button sits, on a row IGDB linked: the same icon, greyed out, so
// the rows line up and it's clear why there's nothing to remove.
export const LockedUnlinkButton = () => {
  const { t } = useTranslation();
  const label = t("games.addonLinks.igdbLinkLocked");
  return (
    <Tooltip title={label}>
      {/* A disabled button fires no events, so the span carries the tooltip. */}
      <span>
        <IconButton size="small" disabled aria-label={label}>
          <LinkOffIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
};
