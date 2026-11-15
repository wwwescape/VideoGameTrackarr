import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHardwarePlatformBySlug } from "../hooks/useHardwareLookups";
import HardwarePage from "./HardwarePage";
import NotFoundPage from "./NotFoundPage";
import Page from "./Page";

// One Hardware → Platforms page: the Hardware lists kept to devices on this platform and
// accessories compatible with it.
const HardwarePlatformPage = () => {
  const { t } = useTranslation();
  const { platformSlug } = useParams<{ platformSlug: string }>();
  const { platform, isLoading, notFound } = useHardwarePlatformBySlug(platformSlug);

  if (notFound) {
    return (
      <NotFoundPage
        title={t("errors.platformNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.platforms") })}
        actionTo="/hardware/platforms"
      />
    );
  }
  if (isLoading || !platform) return <Page>{t("common.loading")}</Page>;
  // Keyed so another platform's page starts from the top with its own lists.
  return <HardwarePage key={platform.id} platformId={platform.id} />;
};

export default HardwarePlatformPage;
