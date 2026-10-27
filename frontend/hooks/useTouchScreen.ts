import useMediaQuery from "@mui/material/useMediaQuery";

// True on a phone or tablet, where the primary pointer is a finger: there, focusing a text
// input raises the on-screen keyboard, so pickers offer a plain list instead (see
// AutocompleteSelect / AutocompleteMultiSelect).
export function useTouchScreen(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
