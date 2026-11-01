import { createSvgIcon } from "@mui/material/SvgIcon";

// A plain currentColor LEGO Dimensions mark for the nav: the portal "O" from its logo, a ring
// with the vortex swirling into it. Same role as IgdbIcon; the full-color logo
// (assets/toys-to-life/lego-dimensions-logo.png) stays for the Toys to Life card.
const LegoDimensionsIcon = createSvgIcon(
  <>
    <path d="M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6zm0 2.4a7.4 7.4 0 1 0 0 14.8 7.4 7.4 0 0 0 0-14.8z" />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12.3 11.8L12.3 11.6L12.2 11.4L12.0 11.1L11.7 11.0L11.3 11.0L10.9 11.2L10.5 11.5L10.3 12.0L10.2 12.5L10.3 13.2L10.6 13.8L11.2 14.3L11.9 14.6L12.8 14.7L13.7 14.4L14.5 13.9L15.1 13.1L15.5 12.1L15.5 11.0L15.2 9.8L14.4 8.8L13.4 8.1L12.1 7.6L10.7 7.6L9.3 8.1L8.1 9.0L7.2 10.3L6.8 11.9L6.8 13.5L7.4 15.2"
    />
  </>,
  "LegoDimensions"
);

export default LegoDimensionsIcon;
