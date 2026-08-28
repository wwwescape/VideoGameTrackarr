import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const formSchema = z.object({
  name: z.string().trim().min(1),
  useCustomColor: z.boolean(),
  color: z.string(),
  textColor: z.string(),
});

export type TagFormValues = z.infer<typeof formSchema>;

const DEFAULT_COLOR = "#7C4DFF";
const DEFAULT_TEXT_COLOR = "#FFFFFF";

interface TagDialogProps {
  open: boolean;
  title: string;
  defaultValues?: { name: string; color: string | null; textColor: string | null };
  onClose: () => void;
  onSubmit: (values: { name: string; color: string | null; textColor: string | null }) => void;
  submitLabel: string;
}

const TagDialog = ({ open, title, defaultValues, onClose, onSubmit, submitLabel }: TagDialogProps) => {
  const { t } = useTranslation();

  const defaults: TagFormValues = {
    name: defaultValues?.name ?? "",
    useCustomColor: Boolean(defaultValues?.color) || Boolean(defaultValues?.textColor),
    color: defaultValues?.color ?? DEFAULT_COLOR,
    textColor: defaultValues?.textColor ?? DEFAULT_TEXT_COLOR,
  };

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TagFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      reset(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const useCustomColor = useWatch({ control, name: "useCustomColor" });

  const handleFormSubmit = (values: TagFormValues) => {
    onSubmit({
      name: values.name.trim(),
      color: values.useCustomColor ? values.color : null,
      textColor: values.useCustomColor ? values.textColor : null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                autoFocus
                label={t("settings.tagManager.nameColumn")}
                required
                error={Boolean(errors.name)}
                helperText={errors.name?.message ?? t("common.required")}
              />
            )}
          />
        </FormControl>
        <Controller
          name="useCustomColor"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
              label={t("dialogs.tag.useCustomColorLabel")}
            />
          )}
        />
        {useCustomColor ? (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography variant="body2" sx={{ minWidth: 90 }}>
                    {t("dialogs.tag.colorLabel")}
                  </Typography>
                  <input type="color" value={field.value} onChange={(event) => field.onChange(event.target.value)} />
                </Box>
              )}
            />
            <Controller
              name="textColor"
              control={control}
              render={({ field }) => (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography variant="body2" sx={{ minWidth: 90 }}>
                    {t("dialogs.tag.textColorLabel")}
                  </Typography>
                  <input type="color" value={field.value} onChange={(event) => field.onChange(event.target.value)} />
                </Box>
              )}
            />
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit(handleFormSubmit)} color="primary">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TagDialog;
