import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Section } from "./Detail";
import { ListSearchField } from "./ListControls";
import PublicAccessoryList from "./PublicAccessoryList";
import PublicDeviceList from "./PublicDeviceList";
import PublicPageHeader from "./PublicPageHeader";

const PublicHardwarePage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 500);

  return (
    <>
      <PublicPageHeader title={t("public.hardware.title")}>
        <ListSearchField
          value={search}
          onChange={setSearch}
          label={t("public.hardware.searchLabel")}
          placeholder={t("hardware.searchBar.searchPlaceholder")}
        />
      </PublicPageHeader>
      <Section id="devices" title={t("public.hardware.devicesHeading")}>
        <PublicDeviceList token={token} search={debouncedSearch} />
      </Section>
      <Section id="accessories" title={t("public.hardware.accessoriesHeading")}>
        <PublicAccessoryList token={token} search={debouncedSearch} />
      </Section>
    </>
  );
};

export default PublicHardwarePage;
