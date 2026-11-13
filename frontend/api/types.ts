export type GameCategory =
  | "main_game"
  | "dlc_addon"
  | "expansion"
  | "bundle"
  | "standalone_expansion"
  | "mod"
  | "episode"
  | "season"
  | "remake"
  | "remaster"
  | "expanded_game"
  | "port"
  | "fork"
  | "pack"
  | "update";

export interface PlatformResponse {
  id: number;
  igdbId: number | null;
  name: string;
  slug: string | null;
  abbreviation: string | null;
}

// Game Shelf (a Labs feature): how a platform's standard game case looks, from the curated
// docs/data/game_cases/Game_Cases.csv. Sizes are real millimetres, colours "#rrggbb".
export interface GameCaseLook {
  platformSlug: string;
  caseLabel: string;
  heightMm: number;
  spineMm: number;
  // How much of the case shows above the logo band (e.g. a PS3 case's clear top), in mm.
  caseTopMm: number;
  caseColor: string;
  logoBandColor: string;
  // The logo band's share of the spine's height, in percent.
  logoBandHeightPct: number;
  // A file in assets/game-cases/; null shows the platform's short name instead.
  logo: string | null;
  // Draws the logo as a one-colour silhouette in this colour; null keeps the file's colours.
  logoColor: string | null;
  // The thin line under the logo band (PS3's red, PS4's white); null for none.
  logoLineColor: string | null;
  titleBandColor: string;
  titleTextColor: string;
}

// A Settings > Game Cases row.
export interface GameCase extends GameCaseLook {
  id: number;
  platformName: string;
  shown: boolean;
  physicalGames: number;
  abbreviation: string | null;
  logoUrl: string | null;
}

// A platform on the shelf and the case its games are drawn in.
export interface ShelfPlatform {
  id: number;
  name: string;
  slug: string | null;
  // The short name the logo band falls back to when the case has no logo file.
  abbreviation: string | null;
  logoUrl: string | null;
  case: GameCaseLook;
}

// What both shelves (private and the share page's) need to draw one case.
export interface ShelfCaseEntry {
  gameId: number;
  name: string;
  platformId: number;
}

// One case on the Game Shelf: a game on one platform you own a physical copy on.
export interface ShelfCase extends ShelfCaseEntry {
  uuid: string;
  slug: string | null;
}

export interface GameShelf {
  // In the requested sort order.
  cases: ShelfCase[];
  platforms: ShelfPlatform[];
}

export interface PublicGameShelf {
  cases: ShelfCaseEntry[];
  platforms: ShelfPlatform[];
}


// A Games → Platforms card: a platform with copies in your library.
export interface LibraryPlatform {
  id: number;
  name: string;
  slug: string | null;
  abbreviation: string | null;
  // Only set on a PC storefront/format card (see utils/platformScope.ts).
  format: MediaFormat | null;
  storefront: string | null;
  ownedCount: number;
  wishlistedCount: number;
}

export interface RegionResponse {
  id: number;
  name: string;
}

// Where a game's metadata comes from: imported from IGDB, or added by hand (igdbId null).
export type GameSource = "igdb" | "custom";

// Released vs not out yet; a game with no release date (announced/TBA) counts as upcoming.
export type ReleaseStatus = "released" | "upcoming";

// A genre at least one owned or wishlisted game has — the Genre filter's options.
export interface GenreSummary {
  id: number;
  name: string;
  slug: string | null;
  gameCount: number;
}

export type PlayStatus = "none" | "backlog" | "playing" | "completed" | "abandoned";

export interface GameSummary {
  id: number;
  uuid: string;
  igdbId: number | null;
  name: string;
  slug: string | null;
  coverUrl: string | null;
  category: GameCategory | null;
  firstReleaseDate: number | null;
  owned: boolean;
  wishlisted: boolean;
  playStatus: PlayStatus | null;
  // Your overall rating, 1-10 stars (null = not rated). IGDB's ratings are on GameDetail.
  rating: number | null;
  isOnSale: boolean;
  // True only for a game (or addon) that only exists locally because a Collection/Series
  // "what's missing" resync discovered it, and hasn't been claimed since. Distinguishes a
  // discovered-but-unclaimed game (greyscale + "Missing" chip) from a manually-added one
  // that just isn't owned/wishlisted yet (greyscale, no chip) — see GameCard.tsx.
  autoDiscovered: boolean;
  // Left out of the Screensaver lab's carousel (its page's toggle, the list's bulk Hide/Show).
  screensaverExcluded: boolean;
  // Games list with Include add-ons: listed only because one of its add-ons matched the search
  // or filters (the "Via add-on" chip). Always false elsewhere.
  matchedViaAddon: boolean;
  steamStoreUrl: string | null;
  xboxStoreUrl: string | null;
  playstationStoreUrl: string | null;
  nintendoStoreUrl: string | null;
  epicGamesStoreUrl: string | null;
  gogStoreUrl: string | null;
  // Only filled by the Games list (GET /api/games): short names of the platforms the game has
  // copies on, and whether an owned copy has a ROM the in-browser emulator can run. Empty and
  // false from every other endpoint.
  libraryPlatforms: string[];
  playable: boolean;
}

export interface GameProgress {
  // Null for the derived-summary embed when a game has no progress on any platform yet;
  // always set for a row returned from the per-platform list/create/update endpoints.
  id: number | null;
  gameId: number;
  platformId: number | null;
  platformName: string | null;
  playStatus: PlayStatus;
  playtimeMinutes: number;
  review: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastPlayedAt: string | null;
}

export interface GameProgressCreateInput {
  platformId: number;
  playStatus?: PlayStatus;
  playtimeMinutes?: number;
  review?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastPlayedAt?: string | null;
}

export interface GameProgressUpdateInput {
  playStatus?: PlayStatus;
  playtimeMinutes?: number;
  review?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastPlayedAt?: string | null;
}

export interface PlaySession {
  id: number;
  gameId: number;
  platformId: number;
  platformName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
}

export interface PlaySessionInput {
  platformId: number;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface Note {
  id: number;
  gameId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceNote {
  id: number;
  deviceId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessoryNote {
  id: number;
  accessoryId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  textColor: string | null;
}

// Powers the Games page's bulk "Manage Tags" dialog — every tag in the library, paired with
// which of a given set of games currently have it (not just a count, so multiple tags'
// coverage can be unioned client-side for an exact "remove from N games" preview).
export interface TagCoverage {
  id: number;
  name: string;
  color: string | null;
  textColor: string | null;
  gameIds: number[];
}

export interface PublicGameSummary {
  id: number;
  name: string;
  coverUrl: string | null;
  category: GameCategory | null;
  firstReleaseDate: number | null;
  owned: boolean;
  wishlisted: boolean;
}

// GET /api/public/{token}/games/{id}: just the About section's data (no tags, library
// copies, progress or notes). rating and the hierarchical parent fields are always null.
export type PublicGameDetail = PublicGameSummary & GameAboutData;

export interface PublicDeviceSummary {
  id: number;
  officialName: string;
  manufacturerName: string;
  hardwarePlatformName: string | null;
  imageUrl: string | null;
  isCustom: boolean;
  owned: boolean;
  wishlisted: boolean;
}

export interface PublicAccessorySummary {
  id: number;
  officialName: string;
  manufacturerName: string;
  imageUrl: string | null;
  isCustom: boolean;
  owned: boolean;
  wishlisted: boolean;
}

export interface CatalogRef {
  id: number;
  name: string;
  slug: string | null;
}

export interface CatalogRefSummary extends CatalogRef {
  gameCount: number;
  // How many of those games you own.
  ownedCount: number;
  // Up to 4: games you have first, then the earliest released.
  coverUrls: string[];
}

export type CompanyRole = "developer" | "publisher" | "porting" | "supporting";

export interface GameCompany {
  id: number;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  role: CompanyRole;
}

export interface GameVideo {
  id: number;
  name: string | null;
  videoId: string;
}

export type IgdbReleaseRegion =
  | "europe"
  | "north_america"
  | "australia"
  | "new_zealand"
  | "japan"
  | "china"
  | "asia"
  | "worldwide";

export interface GameReleaseDate {
  id: number;
  date: number | null;
  human: string | null;
  platformName: string | null;
  releaseRegion: IgdbReleaseRegion | null;
}

export interface GameDetail extends GameSummary {
  summary: string | null;
  storyline: string | null;
  edition: string | null;
  igdbUrl: string | null;
  steamAppId: number | null;
  parentGameId: number | null;
  parentGameName: string | null;
  parentGameSlug: string | null;
  parentGameUuid: string | null;
  displayParentGameId: number | null;
  displayParentGameName: string | null;
  displayParentGameSlug: string | null;
  displayParentGameUuid: string | null;
  externalParentName: string | null;
  externalParentIgdbUrl: string | null;
  // IGDB's members' and critics' ratings (0-100; shown /10 like IGDB) and how many each is
  // based on — null when IGDB has none.
  igdbRating: number | null;
  igdbRatingCount: number | null;
  igdbCriticRating: number | null;
  igdbCriticRatingCount: number | null;
  // Added by hand and later linked to IGDB: offers Change IGDB link and Unlink from IGDB.
  // Never shown as custom.
  linkedFromCustom: boolean;
  progress: GameProgress;
  tags: Tag[];
  genres: CatalogRef[];
  companies: GameCompany[];
  franchises: CatalogRef[];
  collections: CatalogRef[];
  platforms: PlatformResponse[];
  screenshotUrls: string[];
  artworkUrls: string[];
  videos: GameVideo[];
  releaseDates: GameReleaseDate[];
}

// Exactly what GameAboutSection reads — satisfied by a real GameDetail and by the Add Game
// page's IGDB preview (IgdbGamePreview), which is never stored locally.
export type GameAboutData = Pick<
  GameDetail,
  | "name"
  | "category"
  | "igdbId"
  | "igdbUrl"
  | "firstReleaseDate"
  | "summary"
  | "storyline"
  | "edition"
  | "igdbRating"
  | "igdbRatingCount"
  | "igdbCriticRating"
  | "igdbCriticRatingCount"
  | "parentGameId"
  | "parentGameName"
  | "parentGameSlug"
  | "parentGameUuid"
  | "displayParentGameId"
  | "displayParentGameName"
  | "displayParentGameSlug"
  | "displayParentGameUuid"
  | "externalParentName"
  | "externalParentIgdbUrl"
  | "genres"
  | "companies"
  | "franchises"
  | "collections"
  | "platforms"
  | "screenshotUrls"
  | "artworkUrls"
  | "videos"
  | "releaseDates"
  | "steamStoreUrl"
  | "xboxStoreUrl"
  | "playstationStoreUrl"
  | "nintendoStoreUrl"
  | "epicGamesStoreUrl"
  | "gogStoreUrl"
>;

// GET /api/igdb/games/{igdbId}: a game straight from IGDB for the Add Game preview page —
// never stored locally. Same field shapes as GameDetail for everything GameAboutSection reads.
export type IgdbGamePreview = GameAboutData &
  Pick<GameDetail, "slug" | "coverUrl" | "owned" | "wishlisted" | "isOnSale" | "autoDiscovered"> & {
    igdbId: number;
    // Set when this IGDB game is already in the library — the page redirects to it.
    localGame: { slug: string | null; uuid: string; name: string } | null;
  };

export interface NamedCount {
  name: string;
  count: number;
}

export interface DashboardStats {
  totalOwned: number;
  totalWishlisted: number;
  totalTracked: number;
  totalPlaytimeMinutes: number;
  averageRating: number | null;
  playStatusBreakdown: Partial<Record<PlayStatus, number>>;
  platformBreakdown: NamedCount[];
  genreBreakdown: NamedCount[];
  recentlyAdded: GameSummary[];
  recentlyPlayed: GameSummary[];
}

export type DashboardItemKind = "game" | "device" | "accessory";

export interface UpcomingRelease {
  kind: DashboardItemKind;
  game?: GameSummary;
  device?: DeviceSummary;
  accessory?: AccessorySummary;
  releaseDate: string;
  // "year" when only the release year is known (releaseDate is then Jan 1 of it).
  releaseDatePrecision: "day" | "year";
}

export interface CatalogBrowseResult {
  id: number;
  name: string;
  slug: string | null;
  games: GameSummary[];
  addons: GameSummary[];
}

export interface ManualGameInput {
  name: string;
  category?: GameCategory;
  firstReleaseDate?: number | null;
  summary?: string | null;
  storyline?: string | null;
  edition?: string | null;
  coverUrl?: string | null;
  parentGameId?: number | null;
  developedBy?: string[];
  publishedBy?: string[];
  platformNames?: string[];
  notes?: string | null;
  steamAppId?: number;
  // Uploaded with uploadGameMedia, in display order (the first artwork is the hero background).
  screenshotUrls?: string[];
  artworkUrls?: string[];
  videos?: ManualGameVideoInput[];
}

// A YouTube video, stored like IGDB's: its title and YouTube's video id.
export interface ManualGameVideoInput {
  name: string | null;
  videoId: string;
}

export interface BackupRestoreResult {
  restoredGames: number;
  restoredLibraryItems: number;
  safetySnapshotPath: string;
  restoredDevices: number;
  restoredAccessories: number;
  // Only a .zip carrying those files brings them back; 0 otherwise.
  restoredRoms: number;
  restoredBiosFiles: number;
  restoredImages: number;
}

export type RestoreJobStatus = "idle" | "running" | "completed" | "failed";

export interface RestoreStatus {
  status: RestoreJobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  result: BackupRestoreResult | null;
  error: string | null;
}

export type CatalogResyncJobStatus = "idle" | "running" | "completed" | "failed";
export type CatalogResyncKind = "collection" | "franchise";

export interface CatalogResyncProgress {
  current: number;
  total: number;
}

export interface CatalogResyncFailure {
  igdbId: number;
  error: string;
}

export interface CatalogResyncResult {
  totalCandidates: number;
  added: number;
  skippedExisting: number;
  failed: number;
  failures: CatalogResyncFailure[];
}

export interface CatalogResyncStatus {
  status: CatalogResyncJobStatus;
  kind: CatalogResyncKind | null;
  refSlug: string | null;
  refName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  progress: CatalogResyncProgress | null;
  result: CatalogResyncResult | null;
  error: string | null;
}

export type JobRunStatus = "idle" | "running" | "completed" | "failed";

export interface ResyncJobFailure {
  gameId: number;
  gameName: string;
  error: string;
}

// Shared by all four resync_* jobs (resync_all/resync_games/resync_collections/
// resync_series) — they differ in which catalog fields get written per game, not in the
// shape of their run result.
export interface ResyncJobResult {
  total: number;
  succeeded: number;
  failed: number;
  failures: ResyncJobFailure[];
}

export interface JobProgress {
  current: number;
  total: number;
}

export interface JobRun {
  status: JobRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  // Generic at the framework level — every job registered today happens to return
  // ResyncJobResult, but a future job's result shape is unconstrained.
  result: Record<string, unknown> | null;
  error: string | null;
  // Only set while status is "running" — cleared back to null once a job finishes, since
  // the final counts already live in `result`.
  progress: JobProgress | null;
}

export interface JobSchedule {
  enabled: boolean;
  cronExpression: string | null;
  nextRunAt: string | null;
  // IANA zone the server reads cron expressions in (its TZ env var, else its own zone).
  timezone: string;
}

export type JobRunTrigger = "manual" | "scheduled" | "catch_up";
// "running" only while the run is in progress; never "idle" (that's in-memory run state).
export type JobRunLogStatus = "running" | "completed" | "failed";

export interface JobRunLogSummary {
  id: number;
  trigger: JobRunTrigger;
  status: JobRunLogStatus;
  startedAt: string;
  finishedAt: string | null;
  // Numeric counts only (the failures list is left out of the run list).
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface JobRunLogLine {
  t: string;
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  msg: string;
}

export interface JobRunLog extends JobRunLogSummary {
  lines: JobRunLogLine[];
}

export interface JobSummary {
  id: string;
  run: JobRun;
  schedule: JobSchedule;
  // Newest run log, which, unlike `run`, survives a server restart.
  lastRun: JobRunLogSummary | null;
}

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
}

export interface WhatsNewRelease {
  version: string;
  name: string;
  // The release notes, as GitHub Markdown.
  body: string;
  url: string;
  publishedAt: string | null;
}

// The release notes not seen since upgrading; empty releases (and notesUnavailable false)
// means there's nothing to show.
export interface WhatsNewInfo {
  currentVersion: string;
  releases: WhatsNewRelease[];
  // GitHub couldn't be reached: show a link to releaseUrl instead of the notes.
  notesUnavailable: boolean;
  releaseUrl: string;
}

export type LibraryStatus = "owned" | "wishlist";
export type MediaFormat = "physical" | "digital" | "iso" | "rom" | "abandonware" | "other";
export type GameSortOption =
  | "name_asc"
  | "name_desc"
  | "release_date_asc"
  | "release_date_desc"
  | "date_added_desc"
  | "date_added_asc"
  | "type_asc"
  | "type_desc"
  | "platforms_asc"
  | "platforms_desc"
  | "play_status_asc"
  | "play_status_desc"
  | "rating_asc"
  | "rating_desc"
  | "library_asc"
  | "library_desc"
  | "labels_asc"
  | "labels_desc";
export type RatingBoard = "esrb" | "pegi" | "cero" | "usk" | "grac" | "classind" | "acb" | "iarc";

export interface LibraryItem {
  id: number;
  gameId: number;
  platformId: number | null;
  platformName: string | null;
  platformSlug: string | null;
  regionId: number | null;
  regionName: string | null;
  status: LibraryStatus;
  format: MediaFormat | null;
  digitalStorefront: string | null;
  ratingBoard: RatingBoard | null;
  edition: string | null;
  price: number | null;
  targetPrice: number | null;
  trackForSales: boolean;
  acquiredAt: string | null;
  notes: string | null;
  steelbook: boolean;
  isOnSale: boolean;
  salePriceAmount: number | null;
  salePriceCurrency: string | null;
  saleShopName: string | null;
  saleCut: number | null;
  // Every ROM attached to this copy (e.g. several regions or revisions), oldest first.
  roms: RomFileSummary[];
}

export type RomUnplayableReason = "unsupported_platform" | "unsupported_file_type" | "missing_bios";

// A ROM attached to one owned ROM/Abandonware/ISO copy. playable/core are resolved by the
// backend (backend/app/services/emulation_cores.py) — never re-derived here.
export interface RomFileSummary {
  id: number;
  label: string | null;
  originalFilename: string;
  sizeBytes: number;
  extension: string;
  isArchive: boolean;
  playable: boolean;
  core: string | null;
  unplayableReason: RomUnplayableReason | null;
  // With unplayableReason "missing_bios": the BIOS system (Settings → Emulation) it needs.
  missingBiosSystem: string | null;
  // Plays in its own cross-origin-isolated tab (DOS, PSP) rather than the in-page dialog.
  isolated: boolean;
  saveStateCount: number;
  hasInGameSave: boolean;
}

// One EmulatorJS save state stored on the server (backend RomSaveState).
export interface SaveState {
  id: number;
  createdAt: string;
  sizeBytes: number;
  hasScreenshot: boolean;
}

// A started in-browser play session (POST /api/roms/{id}/play-session) — not to be confused
// with PlaySession above, which is a logged play-time record.
export interface EmulatorSession {
  romUrl: string;
  core: string;
  gameName: string;
  isolated: boolean;
  // Uploaded BIOS files the player writes into the emulator's filesystem before starting.
  biosFiles: { filename: string; url: string }[];
  // Extra EmulatorJS core options (EJS_defaultOptions) this session needs.
  coreOptions: Record<string, string>;
}

// Settings → Emulation: one BIOS system (GET /api/emulation/bios).
export interface BiosAcceptedFile {
  filename: string;
  note: string | null;
  satisfies: boolean;
  hasReferenceHash: boolean;
}

export interface BiosUploadedFile {
  id: number;
  filename: string;
  sizeBytes: number;
  md5: string;
  recognized: boolean;
  updatedAt: string;
}

export interface BiosSystem {
  key: string;
  label: string;
  required: boolean;
  ready: boolean;
  systems: string[];
  acceptedFiles: BiosAcceptedFile[];
  uploadedFiles: BiosUploadedFile[];
}

export interface EmulatorCoreInfo {
  core: string;
  system: string;
  license: string;
  upstreamUrl: string;
  nonCommercial: boolean;
}

// GET /api/emulation — the backend's own upload allowlists/size cap, so the upload picker
// never keeps a second copy of them.
export interface EmulationConfig {
  emulatorjsVersion: string;
  cores: EmulatorCoreInfo[];
  allowedUploadExtensions: Partial<Record<MediaFormat, string[]>>;
  maxUploadMb: number;
  // Platforms some bundled core plays — ROMs can only be uploaded for these.
  supportedPlatformSlugs: string[];
}

export interface LibraryItemInput {
  status: LibraryStatus;
  platformId?: number | null;
  regionId?: number | null;
  format?: MediaFormat | null;
  digitalStorefront?: string | null;
  ratingBoard?: RatingBoard | null;
  edition?: string | null;
  price?: number | null;
  targetPrice?: number | null;
  trackForSales?: boolean;
  acquiredAt?: string | null;
  notes?: string | null;
  steelbook?: boolean;
}

// Step 3 of BulkAddDialog — a deliberate subset of LibraryItemInput (just Ownership/
// Platform/Format/Digital Storefront), applied identically to every successfully-imported
// game. Matches the backend's BulkImportLibraryDefaults exactly.
export interface BulkImportLibraryDefaults {
  status: LibraryStatus;
  platformId?: number | null;
  format?: MediaFormat | null;
  digitalStorefront?: string | null;
}

export interface BulkImportRequest {
  igdbIds: number[];
  tagIds?: number[];
  libraryDefaults?: BulkImportLibraryDefaults | null;
}

export type BulkImportJobStatus = "idle" | "running" | "completed" | "failed";

export interface BulkImportFailure {
  igdbId: number;
  gameName: string | null;
  error: string;
}

export interface BulkImportResult {
  total: number;
  succeeded: number;
  failed: number;
  failures: BulkImportFailure[];
}

export interface BulkImportStatusResponse {
  status: BulkImportJobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  progress: { current: number; total: number } | null;
  result: BulkImportResult | null;
  error: string | null;
}

export interface IgdbParentGame {
  igdbId: number;
  name: string;
}

export interface IgdbSearchResult {
  igdbId: number;
  name: string;
  slug: string | null;
  summary: string | null;
  coverUrl: string | null;
  category: GameCategory | null;
  firstReleaseDate: number | null;
  parentGame: IgdbParentGame | null;
}

export interface DuplicateLibraryItemGroup {
  gameId: number;
  gameName: string;
  gameSlug: string | null;
  gameUuid: string;
  items: LibraryItem[];
}

export interface InsightGameRef {
  id: number;
  uuid: string;
  name: string;
  slug: string | null;
  coverUrl: string | null;
  category: GameCategory | null;
  firstReleaseDate: number | null;
  // GameCard needs these to decide greyscale/the "Missing" chip — see GameCard.tsx.
  owned: boolean;
  wishlisted: boolean;
  autoDiscovered: boolean;
}

export interface MissingAddonsEntry {
  game: InsightGameRef;
  missingAddons: InsightGameRef[];
}

export interface OnSaleItem {
  libraryItemId: number;
  game: InsightGameRef;
  currentPriceAmount: number;
  currentPriceCurrency: string | null;
  currentShopName: string | null;
  currentCut: number | null;
  historicalLowAmount: number | null;
  historicalLowCurrency: string | null;
  historicalLowShopName: string | null;
  historicalLowAt: string | null;
  targetPrice: number | null;
  isTargetHit: boolean;
}

export interface InsightAccessoryRef {
  id: number;
  uuid: string;
  officialName: string;
  imageUrl: string | null;
  manufacturerName: string;
  accessoryTypeName: string;
  // No hardware reference catalog entry (the "Custom" chip).
  isCustom: boolean;
  // Always owned (the page's premise); this is whether it's also wishlisted.
  wishlisted: boolean;
  // When it was added here (ISO timestamp).
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface CurrentUser {
  id: number;
  username: string;
  // The account's display currency; null until one is chosen.
  currency: string | null;
  // The Overview's sections in order; null until customised (see hooks/useOverviewLayout.ts).
  overviewLayout: OverviewSectionSetting[] | null;
  // The Screensaver lab's seconds per cover (5-15); null until changed (see SCREENSAVER_DEFAULT_INTERVAL).
  screensaverIntervalSeconds: number | null;
  // Settings → Screensaver → What to show (owned and wishlist are never both off).
  screensaverShowOwned: boolean;
  screensaverShowWishlist: boolean;
  screensaverIncludeCustom: boolean;
}

// The Games list's Screensaver filter: games shown in it, or hidden from it.
export type ScreensaverFilter = "shown" | "hidden";

// One slide of the Screensaver lab: just what the carousel shows and what opening the game needs.
export interface ScreensaverGame {
  id: number;
  uuid: string;
  slug: string | null;
  name: string;
  coverUrl: string;
}

// GET /api/games/screensaver: a random sample (at most 500) of the games it shows, and how
// many there are in all.
export interface ScreensaverSample {
  games: ScreensaverGame[];
  total: number;
}

export interface OverviewSectionSetting {
  key: string;
  hidden: boolean;
}

export interface SetupStatus {
  setupRequired: boolean;
}

export interface NamedLookup {
  id: number;
  name: string;
}

export type HardwareCondition = "sealed" | "new" | "like_new" | "good" | "fair" | "poor";

export type HardwareReferenceType = "Device" | "Accessory";

// One row imported from docs/data/hardware/*.csv — powers the Brand/Console/Variant cascades on
// the Add Device/Add Accessory (Predefined) forms. See DevicePredefinedFields.tsx /
// AccessoryPredefinedFields.tsx.
export interface HardwareReferenceEntry {
  id: number;
  brand: string;
  family: string | null;
  generation: string;
  generationShort: string | null;
  artefact: string;
  officialName: string;
  category: string;
  type: HardwareReferenceType;
  releaseDate: string | null;
  discontinued: boolean;
  compatibility: string | null;
  summary: string | null;
  imageUrl: string | null;
}

// Nested "rich data" block on Device/Accessory detail responses — only the fields not
// already represented on the catalog row itself.
export interface HardwareReferenceSummary {
  family: string | null;
  artefact: string;
  category: string;
  releaseDate: string | null;
  discontinued: boolean;
  compatibility: string | null;
  summary: string | null;
  imageUrl: string | null;
}

export interface DeviceSummary {
  id: number;
  uuid: string;
  manufacturerId: number;
  manufacturerName: string;
  hardwarePlatformId: number | null;
  hardwarePlatformName: string | null;
  deviceTypeId: number;
  officialName: string;
  model: string | null;
  revision: string | null;
  storageVariantName: string | null;
  colorId: number | null;
  colorName: string | null;
  ratingBoard: RatingBoard | null;
  imageUrl: string | null;
  // Not linked to a hardware reference catalog entry; shown with a "Custom" chip, like a
  // game with no igdbId.
  isCustom: boolean;
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
  wishlistedQuantity: number;
  // When it was added here (ISO timestamp), for the Hardware page's Date added sort.
  createdAt: string;
}

// A device or accessory linked to the one being viewed, with what its card shows (the same as
// on the Hardware page).
export interface LinkedHardware {
  id: number;
  uuid: string;
  officialName: string;
  manufacturerName: string;
  // After the manufacturer on the card: a device's platform, an accessory's type.
  detail: string | null;
  imageUrl: string | null;
  isCustom: boolean;
  owned: boolean;
  wishlisted: boolean;
}

export type LinkedAccessory = LinkedHardware;

export interface DeviceDetail extends DeviceSummary {
  linkedAccessories: LinkedAccessory[];
  hardwareReference: HardwareReferenceSummary | null;
  tags: Tag[];
}

export interface DeviceInput {
  manufacturer: string;
  deviceType: string;
  hardwarePlatform?: string | null;
  officialName: string;
  model?: string | null;
  revision?: string | null;
  storageVariant?: string | null;
  color?: string | null;
  ratingBoard?: RatingBoard | null;
  // Set by DevicePredefinedFields.tsx once it resolves a matching HardwareReferenceEntry —
  // links the catalog row to its source reference row. Omitted for any future custom-device
  // creation, which has no reference row to match.
  hardwareReferenceEntryId?: number | null;
  // Bundled in the same create call as the catalog fields above — see
  // device_service.create_device and AddDeviceForm.tsx.
  ownership?: UserDeviceInput;
}

export interface CompatiblePlatform {
  id: number;
  name: string;
}

export interface AccessorySummary {
  id: number;
  uuid: string;
  manufacturerId: number;
  manufacturerName: string;
  accessoryTypeId: number;
  accessoryTypeName: string;
  officialName: string;
  model: string | null;
  revision: string | null;
  edition: string | null;
  // Year only — Custom Accessory only ever collects a release year.
  releaseDate: number | null;
  colorId: number | null;
  colorName: string | null;
  ratingBoard: RatingBoard | null;
  imageUrl: string | null;
  summary: string | null;
  // Made with Add Accessory's Custom mode (no hardware reference catalog entry); shown with a
  // "Custom" chip, like a game with no igdbId.
  isCustom: boolean;
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
  wishlistedQuantity: number;
  // When it was added here (ISO timestamp), for the Hardware page's Date added sort.
  createdAt: string;
}

export type LinkedDevice = LinkedHardware;

export interface AccessoryDetail extends AccessorySummary {
  compatiblePlatforms: CompatiblePlatform[];
  linkedDevices: LinkedDevice[];
  linkedAccessories: LinkedAccessory[];
  hardwareReference: HardwareReferenceSummary | null;
  tags: Tag[];
}

export interface AccessoryInput {
  manufacturer: string;
  accessoryType: string;
  officialName: string;
  model?: string | null;
  revision?: string | null;
  edition?: string | null;
  releaseDate?: number | null;
  color?: string | null;
  ratingBoard?: RatingBoard | null;
  summary?: string | null;
  deviceIds?: number[];
  accessoryIds?: number[];
  imageUrl?: string | null;
  compatiblePlatforms?: string[];
  // Set by AccessoryPredefinedFields.tsx once it resolves a matching HardwareReferenceEntry.
  // Omitted for custom-mode accessories, which have no reference row to match.
  hardwareReferenceEntryId?: number | null;
  // Bundled in the same create call as the catalog fields above — see
  // accessory_service.create_accessory and AddAccessoryForm.tsx.
  ownership?: UserAccessoryInput;
}

export interface UserDevice {
  id: number;
  deviceId: number;
  status: LibraryStatus;
  condition: HardwareCondition | null;
  purchasePrice: number | null;
  serialNumber: string | null;
  notes: string | null;
}

export interface UserDeviceInput {
  status: LibraryStatus;
  condition?: HardwareCondition | null;
  purchasePrice?: number | null;
  serialNumber?: string | null;
  notes?: string | null;
}

export interface UserAccessory {
  id: number;
  accessoryId: number;
  status: LibraryStatus;
  condition: HardwareCondition | null;
  purchasePrice: number | null;
  serialNumber: string | null;
  notes: string | null;
}

export interface UserAccessoryInput {
  status: LibraryStatus;
  condition?: HardwareCondition | null;
  purchasePrice?: number | null;
  serialNumber?: string | null;
  notes?: string | null;
}

export interface RecentlyAddedHardwareItem {
  kind: "device" | "accessory";
  device?: DeviceSummary;
  accessory?: AccessorySummary;
}

export interface HardwareStats {
  ownedConsoles: number;
  ownedAccessories: number;
  wishlistHardware: number;
  manufacturerDistribution: NamedCount[];
  platformDistribution: NamedCount[];
  collectionValue: number;
  recentlyAdded: RecentlyAddedHardwareItem[];
}

export interface EventSummary {
  id: number;
  name: string;
  slug: string | null;
  startTime: number | null;
  endTime: number | null;
  eventLogoUrl: string | null;
}

// Shaped identically to GameVideo — the existing VideoGallery/VideoDialog components accept
// an event's videos array unmodified.
export type EventVideo = GameVideo;

export interface EventNetwork {
  id: number;
  networkType: string | null;
  url: string;
}

export interface EventGameTile {
  igdbGameId: number;
  gameId: number | null;
  name: string | null;
  coverUrl: string | null;
  // Only set when gameId is set — combine with gameIdentifier({slug, uuid, name}) to link to
  // the local game's own details page.
  gameSlug: string | null;
  gameUuid: string | null;
}

export interface EventDetail extends EventSummary {
  igdbId: number;
  timeZone: string | null;
  description: string | null;
  liveStreamUrl: string | null;
  igdbUpdatedAt: number | null;
  videos: EventVideo[];
  networks: EventNetwork[];
  games: EventGameTile[];
}

// Toys-to-Life (LEGO Dimensions, ...): a line's packs are reference data seeded from the
// project's CSVs; only the ownership, rating, tags and notes are yours.
export interface ToysToLifeParentGame {
  name: string;
  igdbId: number;
  // Set only when the game is in your library (its page exists).
  slug: string | null;
  uuid: string | null;
  coverUrl: string | null;
}

export interface ToysToLifeLine {
  slug: string;
  name: string;
  parentGame: ToysToLifeParentGame;
  packCount: number;
  ownedCount: number;
  wishlistCount: number;
}

export interface ToysToLifeItemSummary {
  id: number;
  uuid: string;
  line: string;
  setNumber: string;
  name: string;
  packType: string;
  franchise: string | null;
  minifigures: string | null;
  // Only starter kits are tied to a platform.
  platformName: string | null;
  platformIgdbId: number | null;
  igdbId: number | null;
  imageUrl: string | null;
  // Like a game: both are true when you own one copy and want another.
  owned: boolean;
  wishlisted: boolean;
  rating: number | null;
}

export type ToysToLifeReleaseRegion = "north_america" | "europe" | "worldwide";

export interface ToysToLifeReleaseDate {
  region: ToysToLifeReleaseRegion;
  // An ISO date, or just a year when that's all that's known.
  date: string;
}

// One copy of a pack you own or want; a pack can have several (sealed and opened, ...).
export interface ToysToLifeCopy {
  id: number;
  status: LibraryStatus;
  // What you paid (owned) or would pay (wishlisted), in your display currency.
  price: number | null;
  notes: string | null;
}

export interface ToysToLifeItemDetail extends ToysToLifeItemSummary {
  // owned/wishlisted follow from these.
  copies: ToysToLifeCopy[];
  summary: string | null;
  igdbUrl: string | null;
  releaseDates: ToysToLifeReleaseDate[];
  lineName: string;
  parentGame: ToysToLifeParentGame;
  tags: Tag[];
}

// The game page's Toys to Life section: its line's packs, with only the starter kits for the
// platforms you own the game on.
export interface ToysToLifeGameSection {
  line: string;
  lineName: string;
  items: ToysToLifeItemSummary[];
}

export interface ToysToLifeNote {
  id: number;
  itemId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}
