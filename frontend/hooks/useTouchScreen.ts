import useMediaQuery from "@mui/material/useMediaQuery";

// True on a phone or tablet, where the primary pointer is a finger: there, focusing a text
// input raises the on-screen keyboard, so pickers open a sheet instead (see
// AutocompleteSelect / AutocompleteMultiSelect). noSsr: phones get the right picker from the first
// render, not the Autocomplete for one frame.
export function useTouchScreen(): boolean {
  return useMediaQuery("(pointer: coarse)", { noSsr: true });
}
