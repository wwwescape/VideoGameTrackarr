import { useSearchParams } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GameDetail } from "../api/types";
import { useGamesByIds } from "../hooks/useGames";
import { getReleaseYear } from "../utils/utils";

const PLAY_STATUS_LABEL: Record<string, string> = {
  none: "Not started",
  backlog: "Backlog",
  playing: "Playing",
  completed: "Completed",
  abandoned: "Abandoned",
};

function companiesFor(game: GameDetail, role: string): string {
  const names = game.companies.filter((company) => company.role === role).map((company) => company.name);
  return names.length > 0 ? names.join(", ") : "-";
}

function formatPlaytime(minutes: number): string {
  if (minutes === 0) return "-";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

const ComparePage = () => {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get("ids") ?? "").split(",").filter((value) => value.length > 0);

  const { data: games, isLoading } = useGamesByIds(ids);
  const loadedGames = games.filter((game): game is GameDetail => Boolean(game));

  if (ids.length < 2) {
    return (
      <Typography variant="body2" color="text.secondary">
        Select two or more games from your library to compare them here.
      </Typography>
    );
  }

  if (isLoading) {
    return <Typography color="text.secondary">Loading comparison...</Typography>;
  }

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Compare Games
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Side-by-side comparison of {loadedGames.length} games from your library.
        </Typography>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  <Avatar
                    variant="rounded"
                    src={game.coverUrl ?? undefined}
                    alt={game.name}
                    sx={{ width: 80, height: 107, mx: "auto", mb: 1 }}
                  />
                  <Typography variant="subtitle2">{game.name}</Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell component="th" scope="row">
                Release year
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {getReleaseYear(game.firstReleaseDate) ?? "Unknown"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Genres
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {game.genres.length > 0 ? game.genres.map((genre) => genre.name).join(", ") : "-"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Developer
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {companiesFor(game, "developer")}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Publisher
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {companiesFor(game, "publisher")}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Platforms
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {game.platforms.length > 0 ? game.platforms.map((platform) => platform.name).join(", ") : "-"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Library status
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {game.owned ? "Owned" : game.wishlisted ? "Wishlisted" : "-"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Play status
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {PLAY_STATUS_LABEL[game.progress.playStatus] ?? "-"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Playtime logged
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {formatPlaytime(game.progress.playtimeMinutes)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell component="th" scope="row">
                Your rating
              </TableCell>
              {loadedGames.map((game) => (
                <TableCell key={game.id} align="center">
                  {game.rating ?? "-"}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default ComparePage;
