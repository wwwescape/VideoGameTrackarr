import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import FavoriteIcon from "@mui/icons-material/Favorite";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ToysIcon from "@mui/icons-material/ToysOutlined";
import VideogameAssetIcon from "@mui/icons-material/VideogameAssetOutlined";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ToysToLifeReleaseDate, ToysToLifeReleaseRegion } from "../api/types";
import {
  useAttachToyTag,
  useCreateToysToLifeNote,
  useDeleteToysToLifeNote,
  useDetachToyTag,
  useSetToysToLifeRating,
  useToysToLifeItem,
  useToysToLifeNotes,
  useUpdateToysToLifeNote,
} from "../hooks/useToysToLife";
import { useCanonicalAddress, useDetailBack } from "../utils/navState";
import { packTypeLabel, parentGamePath, setNumberFromIdentifier, toyPath } from "../utils/toysToLife";
import { DetailColumns, EmptyLine, Facts, Pill, Section } from "./Detail";
import ExpandableText from "./ExpandableText";
import { HardwareHero } from "./HardwareDetailParts";
import NotesSection from "./NotesSection";
import NotFoundPage from "./NotFoundPage";
import Page, { ToolbarButton, useRouteCrumbs } from "./Page";
import TagsSection from "./TagsSection";
import ToysToLifeCollectionSection from "./ToysToLifeCollectionSection";
import { RatingSection } from "./YourRatingSection";

const REGION_KEYS: Record<ToysToLifeReleaseRegion, string> = {
  north_america: "games.about.regionNorthAmerica",
  europe: "games.about.regionEurope",
  worldwide: "games.about.regionWorldwide",
};

// "2015-09-27" in the reader's language; a bare year ("2017") as is. Built from its parts, so
// it's that day wherever you are (new Date("2015-09-27") is midnight UTC).
function formatToyDate(date: string, language: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const earliestYear = (dates: ToysToLifeReleaseDate[]) =>
  dates.length ? dates.map((releaseDate) => releaseDate.date).sort()[0].slice(0, 4) : null;

// A Toys-to-Life pack's page, laid out like an add-on's: the pack in the hero with its
// ownership, platform (starter kits) and the game it's for, its IGDB page on a row of its own;
// About and Release Dates; then your rating, your copies (Your Collection), tags and notes.
const ToysToLifePackDetails = () => {
  const { t, i18n } = useTranslation();
  const { line, pack } = useParams<{ line: string; pack: string }>();
  const { data: item, isError } = useToysToLifeItem(line, setNumberFromIdentifier(pack));
  const itemId = item?.id ?? NaN;

  const setRating = useSetToysToLifeRating(itemId);
  const attachTag = useAttachToyTag(itemId);
  const detachTag = useDetachToyTag(itemId);
  const { data: notes } = useToysToLifeNotes(itemId);
  const createNote = useCreateToysToLifeNote(itemId);
  const updateNote = useUpdateToysToLifeNote(itemId);
  const deleteNote = useDeleteToysToLifeNote(itemId);

  const routeCrumbs = useRouteCrumbs();
  const { back, toList } = useDetailBack(`/toys-to-life/${line ?? ""}`);
  // The address carries the name; correct a stale or hand-typed one in place.
  useCanonicalAddress(item ? toyPath(item) : null);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.toyNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.toysToLife") })}
        actionTo={`/toys-to-life/${line ?? ""}`}
      />
    );
  }

  if (!item) {
    return (
      <Page>
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      </Page>
    );
  }

  // Both chips when you own one copy and want another, as on a game's page.
  const { owned, wishlisted } = item;

  return (
    <Page
      crumbs={[]}
      toolbar={
        <>
          <ToolbarButton icon={<ArrowBackIcon />} label={toList ? item.lineName : t("detail.back")} onClick={back} />
        </>
      }
      hero={
        <HardwareHero
          name={item.name}
          imageUrl={item.imageUrl}
          owned={owned}
          wishlisted={wishlisted}
          crumbs={routeCrumbs.slice(0, -1)}
          subline={[item.setNumber, packTypeLabel(item.packType, t), item.franchise, earliestYear(item.releaseDates)]}
          pills={
            <>
              {owned ? (
                <Pill tone="owned" icon={<CheckIcon />}>
                  {t("ownershipBadges.ownedTooltip")}
                </Pill>
              ) : null}
              {wishlisted ? (
                <Pill tone="wishlist" icon={<FavoriteIcon />}>
                  {t("ownershipBadges.wishlistTooltip")}
                </Pill>
              ) : null}
              {item.platformName ? <Pill icon={<VideogameAssetIcon />}>{item.platformName}</Pill> : null}
              <Pill icon={<ToysIcon />} to={parentGamePath(item.parentGame)}>
                {t("toysToLife.pack.toyOf", { name: item.parentGame.name })}
              </Pill>
            </>
          }
          links={
            item.igdbUrl ? (
              <Pill href={item.igdbUrl} title={t("games.about.viewOnIgdb")} icon={<OpenInNewIcon />}>
                IGDB
              </Pill>
            ) : undefined
          }
        />
      }
    >
      <DetailColumns
        main={
          <>
            <Section id="about" title={t("games.detail.aboutTitle")}>
              {item.summary ? (
                <Box sx={{ color: "text.secondary", maxWidth: 900, mb: 2 }}>
                  <ExpandableText text={item.summary} />
                </Box>
              ) : null}
              <Facts
                facts={[
                  [t("toysToLife.pack.setNumberLabel"), item.setNumber],
                  [t("toysToLife.pack.packTypeLabel"), packTypeLabel(item.packType, t)],
                  [t("toysToLife.pack.franchiseLabel"), item.franchise],
                  [t("toysToLife.pack.minifiguresLabel"), item.minifigures],
                  [t("toysToLife.pack.platformLabel"), item.platformName],
                ]}
              />
            </Section>
            <Section id="release-dates" title={t("toysToLife.pack.releaseDatesTitle")}>
              {item.releaseDates.length === 0 ? (
                <EmptyLine>{t("toysToLife.pack.noReleaseDates")}</EmptyLine>
              ) : (
                <Box
                  component="ul"
                  sx={{
                    listStyle: "none",
                    m: 0,
                    px: 1.75,
                    py: 0.5,
                    bgcolor: "background.paper",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  {item.releaseDates.map((releaseDate, index) => (
                    <Box
                      component="li"
                      key={releaseDate.region}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        columnGap: 1.5,
                        py: 0.75,
                        borderTop: index ? 1 : 0,
                        borderColor: "divider",
                        fontSize: 13.5,
                      }}
                    >
                      <span>{t(REGION_KEYS[releaseDate.region])}</span>
                      <Typography component="span" sx={{ fontSize: "inherit", fontVariantNumeric: "tabular-nums" }}>
                        {formatToyDate(releaseDate.date, i18n.resolvedLanguage ?? i18n.language)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Section>
          </>
        }
        side={
          <>
            <RatingSection
              name={`toy-${item.id}-rating`}
              rating={item.rating}
              onSave={(next) => setRating.mutateAsync(next)}
            />
            <ToysToLifeCollectionSection itemId={item.id} copies={item.copies} />
            <TagsSection
              tags={item.tags}
              onAttach={(tagId) => attachTag.mutateAsync(tagId)}
              onDetach={(tagId) => detachTag.mutateAsync(tagId)}
            />
            <NotesSection
              notes={notes}
              isCreating={createNote.isPending}
              onCreate={(body) => createNote.mutateAsync(body)}
              onUpdate={(noteId, body) => updateNote.mutateAsync({ noteId, body })}
              onDelete={(noteId) => deleteNote.mutateAsync(noteId)}
            />
          </>
        }
      />
    </Page>
  );
};

export default ToysToLifePackDetails;
