import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

// Material Symbols "developer_guide" (outlined, weight 400, grade 0, 24px; Apache-2.0), from
// google/material-design-icons symbols/web/developer_guide/materialsymbolsoutlined. Not in
// @mui/icons-material, which only has Material Icons. Symbols are drawn on a 960-unit grid,
// hence the viewBox; like GogIcon it takes its color and size from where it's used.
const GuideIcon = (props: SvgIconProps) => (
  <SvgIcon viewBox="0 -960 960 960" {...props}>
    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-640v560h560v-560h-80v280l-100-60-100 60v-280H200Zm0 560v-560 560Z" />
  </SvgIcon>
);

export default GuideIcon;
