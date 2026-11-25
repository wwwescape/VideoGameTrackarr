import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LibraryItem, PlatformResponse } from "../api/types";
import { copyOptions } from "../utils/guides";
import DocumentsSection from "./DocumentsSection";

interface GuidesCheatsSectionProps {
  gameId: number;
  libraryItems: LibraryItem[] | undefined;
  gamePlatforms: PlatformResponse[] | undefined;
}

// A game's Guides & Cheats: guides, cheat sheets, manuals, receipts and other documents (see
// DocumentsSection). A receipt can name the library copy it's for.
const GuidesCheatsSection = ({ gameId, libraryItems, gamePlatforms }: GuidesCheatsSectionProps) => {
  const { t } = useTranslation();
  const owner = useMemo(() => ({ type: "game" as const, id: gameId }), [gameId]);
  const copies = useMemo(() => copyOptions(t, libraryItems ?? []), [libraryItems, t]);
  return (
    <DocumentsSection
      owner={owner}
      sectionId="guides"
      title={t("guides.title")}
      emptyText={t("guides.empty")}
      copies={copies}
      libraryItems={libraryItems}
      gamePlatforms={gamePlatforms}
    />
  );
};

export default GuidesCheatsSection;
