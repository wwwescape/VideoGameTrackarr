import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import linkIcon from "../assets/link.png";
import twitchLogo from "../assets/twitch-logo.png";
import xLogo from "../assets/x-logo.png";
import youtubeLogo from "../assets/youtube-logo.png";
import type { EventNetwork } from "../api/types";

// IGDB's network_type is a free-text reference-entity name (e.g. "YouTube", "Twitter",
// "Official website") — matched case-insensitively against the brand assets we have, falling
// back to a generic link glyph for anything else (including "Official website"). IGDB's own
// data still labels this network "Twitter" (confirmed live), but x-logo.png (the platform's
// current brand mark) is used here rather than the retired bird — easy to swap back to
// twitter-logo.png if that reads wrong.
const NETWORK_LOGOS: Record<string, string> = {
  youtube: youtubeLogo,
  twitter: xLogo,
  x: xLogo,
  twitch: twitchLogo,
};

function logoForNetworkType(networkType: string | null): string {
  if (!networkType) return linkIcon;
  const key = Object.keys(NETWORK_LOGOS).find((candidate) =>
    networkType.toLowerCase().includes(candidate)
  );
  return key ? NETWORK_LOGOS[key] : linkIcon;
}

interface EventNetworksSectionProps {
  networks: EventNetwork[];
}

const EventNetworksSection = ({ networks }: EventNetworksSectionProps) => {
  const { t } = useTranslation();
  const theme = useTheme();

  if (networks.length === 0) return null;

  return (
    <>
      <Typography variant="subtitle2" gutterBottom>
        {t("events.networks.heading")}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 2 }}>
        {networks.map((network) => {
          const logo = logoForNetworkType(network.networkType);
          const label = network.networkType ?? t("common.unknown");
          return (
            <Tooltip key={network.id} title={label}>
              <a
                href={network.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.text.primary }}
              >
                <img
                  src={logo}
                  alt={label}
                  style={{
                    width: "40px",
                    // link.png is a bare black line-art glyph with no fill — invisible against
                    // a dark card in dark mode without this, unlike the other brand marks
                    // here which already carry their own colored/filled background shape.
                    filter:
                      logo === linkIcon && theme.palette.mode === "dark" ? "invert(1)" : "none",
                  }}
                />
              </a>
            </Tooltip>
          );
        })}
      </Stack>
    </>
  );
};

export default EventNetworksSection;
