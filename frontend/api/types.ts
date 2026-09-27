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

export interface RegionResponse {
  id: number;
  name: string;
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
  rating: number | null;
  isOnSale: boolean;
  // True only for a game (or addon) that only exists locally because a Collection/Series
  // "what's missing" resync discovered it, and hasn't been claimed since. Distinguishes a
  // discovered-but-unclaimed game (greyscale + "Missing" chip) from a manually-added one
  // that just isn't owned/wishlisted yet (greyscale, no chip) — see GameCard.tsx.
  autoDiscovered: boolean;
  steamStoreUrl: string | null;
  xboxStoreUrl: string | null;
  playstationStoreUrl: string | null;
  nintendoStoreUrl: string | null;
  epicGamesStoreUrl: string | null;
  gogStoreUrl: string | null;
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
  rating: number | null;
  review: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastPlayedAt: string | null;
}

export interface GameProgressCreateInput {
  platformId: number;
  playStatus?: PlayStatus;
  playtimeMinutes?: number;
  rating?: number | null;
  review?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastPlayedAt?: string | null;
}

export interface GameProgressUpdateInput {
  playStatus?: PlayStatus;
  playtimeMinutes?: number;
  rating?: number | null;
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

export interface PublicDeviceSummary {
  id: number;
  officialName: string;
  manufacturerName: string;
  hardwarePlatformName: string | null;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
}

export interface PublicAccessorySummary {
  id: number;
  officialName: string;
  manufacturerName: string;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
}

export interface CatalogRef {
  id: number;
  name: string;
  slug: string | null;
}

export interface CatalogRefSummary extends CatalogRef {
  gameCount: number;
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
  | "rating"
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
}

export interface BackupRestoreResult {
  restoredGames: number;
  restoredLibraryItems: number;
  safetySnapshotPath: string;
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
}

export interface JobSummary {
  id: string;
  run: JobRun;
  schedule: JobSchedule;
}

export interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
}

export type LibraryStatus = "owned" | "wishlist";
export type MediaFormat = "physical" | "digital" | "iso" | "rom" | "abandonware" | "other";
export type GameSortOption = "name_asc" | "name_desc" | "release_date_asc" | "release_date_desc";
export type CatalogSortOption = "name_asc" | "name_desc";
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
  rom: RomFileSummary | null;
}

export type RomUnplayableReason = "unsupported_platform" | "unsupported_file_type";

// A ROM attached to one owned ROM/Abandonware/ISO copy. playable/core are resolved by the
// backend (backend/app/services/emulation_cores.py) — never re-derived here.
export interface RomFileSummary {
  id: number;
  originalFilename: string;
  sizeBytes: number;
  extension: string;
  isArchive: boolean;
  playable: boolean;
  core: string | null;
  unplayableReason: RomUnplayableReason | null;
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
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface CurrentUser {
  id: number;
  username: string;
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
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
  wishlistedQuantity: number;
}

export interface LinkedAccessory {
  id: number;
  uuid: string;
  officialName: string;
}

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
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
  wishlistedQuantity: number;
}

export interface LinkedDevice {
  id: number;
  uuid: string;
  officialName: string;
}

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
