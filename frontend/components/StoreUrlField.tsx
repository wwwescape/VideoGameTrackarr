import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import { STORE_NAMES, detectStore } from "../utils/storeUrls";

interface StoreUrlFieldProps {
  value: string;
  onChange: (value: string) => void;
}

// Whether a Store URL can be saved: empty, or a link to a store VGT recognises.
export const isValidStoreUrl = (value: string) => !value.trim() || detectStore(value) !== null;

// A custom add-on's store page: one link, with the store it was recognised as (or why it wasn't)
// right under it as you type.
const StoreUrlField = ({ value, onChange }: StoreUrlFieldProps) => {
  const { t } = useTranslation();
  const store = value.trim() ? detectStore(value) : null;
  const invalid = Boolean(value.trim()) && store === null;
  return (
    <TextField
      label={t("games.gameForm.storeUrlLabel")}
      fullWidth
      type="url"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={invalid}
      helperText={
        invalid
          ? t("games.gameForm.storeUrlInvalid")
          : store
            ? t("games.gameForm.storeUrlRecognised", { store: STORE_NAMES[store] })
            : t("games.gameForm.storeUrlHelperText")
      }
    />
  );
};

export default StoreUrlField;
