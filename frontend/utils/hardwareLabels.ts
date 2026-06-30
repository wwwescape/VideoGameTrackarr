import type { HardwareCondition, RatingBoard } from "../api/types";

export const CONDITION_LABELS: Record<HardwareCondition, string> = {
  sealed: "Sealed",
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export const RATING_BOARD_LABELS: Record<RatingBoard, string> = {
  esrb: "ESRB",
  pegi: "PEGI",
  cero: "CERO",
  usk: "USK",
  grac: "GRAC",
  classind: "ClassInd",
  acb: "ACB",
  iarc: "IARC",
};

// Custom Accessory's "Accessory type" dropdown is otherwise derived entirely from the
// categories present in HardwareReferenceEntry rows (see AddAccessoryForm.tsx/
// EditAccessoryPage.tsx) — these two have no reference-data category of their own, so they're
// added in alongside whatever categories are found.
export const EXTRA_CUSTOM_ACCESSORY_TYPES = ["Protection", "Cables"];
