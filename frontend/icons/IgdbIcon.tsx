import { createSvgIcon } from "@mui/material/SvgIcon";

// A plain currentColor IGDB mark (the "IGDB" wordmark in a rounded badge) for spots where IGDB
// sits alongside @mui/icons-material icons, e.g. the nav — same role as SteamIcon. The full-
// color assets/igdb-logo.png stays for branding (Settings -> Integrations, store links).
const IgdbIcon = createSvgIcon(
  <>
    <path d="M4 4h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm0 1.8A1.2 1.2 0 0 0 2.8 7v10A1.2 1.2 0 0 0 4 18.2h16a1.2 1.2 0 0 0 1.2-1.2V7A1.2 1.2 0 0 0 20 5.8z" />
    <text
      x="12"
      y="14.7"
      textAnchor="middle"
      fontFamily="Arial, Helvetica, sans-serif"
      fontSize="7.4"
      fontWeight="700"
      letterSpacing="-0.2"
    >
      IGDB
    </text>
  </>,
  "Igdb"
);

export default IgdbIcon;
