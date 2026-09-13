import { useTranslation } from "react-i18next";
import { useOnSale } from "../hooks/useInsights";
import CardCarousel from "./CardCarousel";
import { OnSaleTile } from "./OnSaleSection";

const TEASER_LIMIT = 15;

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
    <CardCarousel
      items={items.slice(0, TEASER_LIMIT)}
      getItemKey={(item) => item.libraryItemId}
      renderItem={(item) => <OnSaleTile item={item} />}
      title={t("insights.dashboard.onSaleHeading")}
      viewAllHref="/insights/on-sale"
    />
  );
};

export default OnSaleTeaserSection;
