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
}

export interface GameProgress {
  gameId: number;
  playStatus: PlayStatus;
  playtimeMinutes: number;
  rating: number | null;
  review: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastPlayedAt: string | null;
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
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
}

export interface PlaySessionInput {
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

export type LibraryStatus = "owned" | "wishlist";
export type MediaFormat = "physical" | "digital" | "iso" | "rom" | "abandonware" | "other";
export type RatingBoard = "esrb" | "pegi" | "cero" | "usk" | "grac" | "classind" | "acb" | "iarc";

export interface LibraryItem {
  id: number;
  gameId: number;
  platformId: number | null;
  platformName: string | null;
  regionId: number | null;
  regionName: string | null;
  status: LibraryStatus;
  format: MediaFormat | null;
  digitalStorefront: string | null;
  ratingBoard: RatingBoard | null;
  edition: string | null;
  price: number | null;
  acquiredAt: string | null;
  notes: string | null;
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
  acquiredAt?: string | null;
  notes?: string | null;
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
}

export interface MissingDlcEntry {
  game: InsightGameRef;
  missingAddons: InsightGameRef[];
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

// One row imported from data/hardware/*.xlsx — powers the Brand/Console/Variant cascades on
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
