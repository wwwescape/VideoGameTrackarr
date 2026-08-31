import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useOnSale } from "../hooks/useInsights";
import OnSaleSection from "./OnSaleSection";

const TEASER_LIMIT = 5;

// Shows nothing at all (heading included) when there's nothing on sale — an always-empty
// "0 games on sale" block would just be noise on a dashboard. DashboardPage itself also
// gates whether this even mounts and owns divider placement between sections, so this
// early return is mostly a defensive fallback if ever reused standalone.
const OnSaleTeaserSection = () => {
  const { t } = useTranslation();
  const { data: items } = useOnSale();

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <>
      <Typography variant="h5" component="h2" gutterBottom>
        {t("insights.dashboard.onSaleHeading")}
      </Typography>
      <OnSaleSection limit={TEASER_LIMIT} />
      {items.length > TEASER_LIMIT && (
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          <Link to="/insights/on-sale">
            {t("insights.dashboard.onSaleSeeAll", { count: items.length })}
          </Link>
        </Typography>
      )}
    </>
  );
};

export default OnSaleTeaserSection;
