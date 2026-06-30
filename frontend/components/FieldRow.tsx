import Typography from "@mui/material/Typography";

interface FieldRowProps {
  label: string;
  value: string | null | undefined;
}

// Shared "Label: value" line used by Device/Accessory Details' summary cards — omits
// itself entirely when there's no value, so callers can list every possible field
// unconditionally.
const FieldRow = ({ label, value }: FieldRowProps) => {
  if (!value) return null;
  return (
    <Typography variant="body2">
      <strong>{label}:</strong> {value}
    </Typography>
  );
};

export default FieldRow;
