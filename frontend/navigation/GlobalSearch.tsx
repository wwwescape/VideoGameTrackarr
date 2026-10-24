import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CableIcon from "@mui/icons-material/Cable";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import GamesIcon from "@mui/icons-material/Games";
import MemoryIcon from "@mui/icons-material/Memory";
import SearchIcon from "@mui/icons-material/Search";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import { useAccessoryList } from "../hooks/useAccessories";
import { useCollections, useFranchises } from "../hooks/useCatalogBrowse";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDeviceList } from "../hooks/useDevice";
import { useGames } from "../hooks/useGames";
import { gameIdentifier, hardwareIdentifier } from "../utils/identifiers";

type Kind = "game" | "device" | "accessory" | "series" | "collection" | "igdb";

interface SearchOption {
  kind: Kind;
  id: number | string;
  label: string;
  detail: string;
  to: string;
  imageUrl?: string | null;
}

const ICONS: Record<Kind, ReactNode> = {
  game: <GamesIcon fontSize="small" />,
  device: <MemoryIcon fontSize="small" />,
  accessory: <CableIcon fontSize="small" />,
  series: <AccountTreeIcon fontSize="small" />,
  collection: <CollectionsBookmarkIcon fontSize="small" />,
  igdb: <TravelExploreIcon fontSize="small" />,
};

const PER_KIND = 5;
const MIN_LENGTH = 2;

// What the search hands to the Games list (Enter) or Add Game ("Search IGDB") through route
// state; both pages apply it once, so it also works when that page is already open.
export interface SearchHandoffState {
  search?: string;
  igdbSearch?: string;
}

// Applies a hand-off from the header search once, then drops it from the history entry so
// Back/refresh don't re-apply a search the user has since cleared.
export function useSearchHandoff(key: keyof SearchHandoffState, apply: (text: string) => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const text = (location.state as SearchHandoffState | null)?.[key];
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (text === undefined) return;
    applyRef.current(text);
    const { [key]: _applied, ...rest } = location.state as SearchHandoffState;
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: Object.keys(rest).length ? rest : null,
    });
  }, [text, key, location.pathname, location.search, location.state, navigate]);
}

// The header's search box: jumps straight to a game, device, accessory, series or
// collection, and Enter on free text opens the Games list filtered by it. The last option
// hands the text to the IGDB search on Add Game. "/" focuses it from anywhere.
const GlobalSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const query = input.trim();
  const debounced = useDebouncedValue(query, 250);
  const active = debounced.length >= MIN_LENGTH;

  // Games come from the server-side search; the smaller lists are filtered here.
  const { data: games } = useGames({ search: debounced }, { enabled: active });
  const { data: devices } = useDeviceList();
  const { data: accessories } = useAccessoryList();
  const { data: franchises } = useFranchises();
  const { data: collections } = useCollections();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const options = useMemo<SearchOption[]>(() => {
    if (!active) return [];
    const needle = debounced.toLowerCase();
    const matches = (name: string) => name.toLowerCase().includes(needle);
    const firstFew = <T,>(list: T[] | undefined, name: (item: T) => string) =>
      (list ?? []).filter((item) => matches(name(item))).slice(0, PER_KIND);

    return [
      ...(games ?? []).slice(0, PER_KIND).map((game) => ({
        kind: "game" as const,
        id: game.id,
        label: game.name,
        detail: game.firstReleaseDate
          ? String(new Date(game.firstReleaseDate * 1000).getUTCFullYear())
          : "",
        to: `/game/${gameIdentifier(game)}`,
        imageUrl: game.coverUrl,
      })),
      ...firstFew(devices, (device) => device.officialName).map((device) => ({
        kind: "device" as const,
        id: device.id,
        label: device.officialName,
        detail: device.hardwarePlatformName ?? device.manufacturerName,
        to: `/hardware/device/${hardwareIdentifier(device.officialName, device.uuid)}`,
      })),
      ...firstFew(accessories, (accessory) => accessory.officialName).map((accessory) => ({
        kind: "accessory" as const,
        id: accessory.id,
        label: accessory.officialName,
        detail: accessory.accessoryTypeName,
        to: `/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}`,
      })),
      ...firstFew(franchises, (franchise) => franchise.name).map((franchise) => ({
        kind: "series" as const,
        id: franchise.id,
        label: franchise.name,
        detail: "",
        to: `/games/series/${franchise.slug ?? ""}`,
      })),
      ...firstFew(collections, (collection) => collection.name).map((collection) => ({
        kind: "collection" as const,
        id: collection.id,
        label: collection.name,
        detail: "",
        to: `/games/collections/${collection.slug ?? ""}`,
      })),
      { kind: "igdb", id: 0, label: t("search.igdb", { query: debounced }), detail: "", to: "" },
    ];
  }, [active, debounced, games, devices, accessories, franchises, collections, t]);

  const choose = (option: SearchOption | string | null) => {
    if (option === null) return;
    if (typeof option === "string") {
      if (!option.trim()) return;
      const state: SearchHandoffState = { search: option.trim() };
      navigate("/games", { state });
    } else if (option.kind === "igdb") {
      const state: SearchHandoffState = { igdbSearch: query };
      navigate("/games/add", { state });
    } else {
      navigate(option.to);
    }
    setInput("");
    inputRef.current?.blur();
  };

  return (
    <Autocomplete<SearchOption, false, false, true>
      freeSolo
      options={options}
      value={null}
      inputValue={input}
      onInputChange={(_event, value, reason) => {
        if (reason !== "reset") setInput(value);
      }}
      onChange={(_event, option) => choose(option)}
      filterOptions={(list) => list}
      groupBy={(option) => t(`search.groups.${option.kind}`)}
      getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
      isOptionEqualToValue={(a, b) =>
        typeof a !== "string" && typeof b !== "string" && a.kind === b.kind && a.id === b.id
      }
      sx={{ width: "100%", maxWidth: 520, mx: "auto" }}
      renderOption={({ key: _key, ...props }, option) => (
        <Box component="li" key={`${option.kind}-${option.id}`} {...props} sx={{ gap: 1.25 }}>
          {option.imageUrl ? (
            <Box
              component="img"
              src={resolveAssetUrl(option.imageUrl) ?? undefined}
              alt=""
              sx={{ width: 24, height: 32, objectFit: "cover", borderRadius: 0.5, flexShrink: 0 }}
            />
          ) : (
            <Box
              sx={{
                color: "vgt.text3",
                display: "flex",
                width: 24,
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {ICONS[option.kind]}
            </Box>
          )}
          <Box
            sx={{
              minWidth: 0,
              flexGrow: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {option.label}
          </Box>
          {option.detail ? (
            <Box sx={{ fontSize: 12, color: "vgt.text3", whiteSpace: "nowrap" }}>
              {option.detail}
            </Box>
          ) : null}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          placeholder={t("search.placeholder")}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, "aria-label": t("search.label") },
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "vgt.text3" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <Box
                  component="kbd"
                  sx={{
                    display: { xs: "none", md: "block" },
                    fontFamily: "inherit",
                    fontSize: 11,
                    color: "vgt.text3",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    px: 0.75,
                    mr: 0.5,
                  }}
                >
                  /
                </Box>
              ),
            },
          }}
        />
      )}
    />
  );
};

export default GlobalSearch;
