import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import type { NamedLookup } from "../api/types";

interface FreeSoloLookupFieldProps {
  label: string;
  options: NamedLookup[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

// Pick an existing lookup-table value or type a brand new one — the backend resolves
// either by name (get-or-create), so there's no separate "create this lookup row first"
// step. Used for manufacturer/hardware type/platform/storage/color fields, all of which
// are meant to grow from user input rather than a hardcoded list.
const FreeSoloLookupField = ({ label, options, value, onChange, required }: FreeSoloLookupFieldProps) => (
  <Autocomplete
    freeSolo
    options={options.map((option) => option.name)}
    value={value || null}
    onChange={(_event, newValue) => onChange(newValue ?? "")}
    onInputChange={(_event, newValue, reason) => {
      if (reason === "input") onChange(newValue);
    }}
    renderInput={(params) => <TextField {...params} label={label} required={required} />}
  />
);

export default FreeSoloLookupField;
