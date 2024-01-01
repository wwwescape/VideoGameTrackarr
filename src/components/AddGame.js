import React from "react";
import { useEffect } from "react";
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { rootPath } from "../config/config";
import TextField from "@mui/material/TextField";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import TabContext from "@mui/lab/TabContext";
import TabList from "@mui/lab/TabList";
import TabPanel from "@mui/lab/TabPanel";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import GameCard from "./GameCard";
import find from "lodash/find";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AddGame = () => {
  const [gameIDs, setGameIDs] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [value, setValue] = useState("1");
  const [searching, setSearching] = useState(false); // State to track if a search is in progress
  const [cancelToken, setCancelToken] = useState(null); // Cancel token for Axios requests
  const [searchTimer, setSearchTimer] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchAllGameIDs();
  }, []); // Empty dependency array ensures it runs only once on mount

  const fetchAllGameIDs = async () => {
    try {
      // Make a request to your backend API to fetch all games
      const response = await axios.get(
        `${rootPath}api/games/ids`
      );

      // Set the retrieved games in the state
      setGameIDs(response.data);
    } catch (error) {
      console.error("Error fetching all games:", error);
    }
  };

  const handleGameClick = (gameId) => {
    // Redirect to the game details page using the game ID
    navigate(`/game/${gameId}/1`);
  };

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const fetchGamesByKeyword = async () => {
    try {
      // If there is an ongoing search, cancel it
      if (cancelToken) {
        cancelToken.cancel("Operation canceled due to new search.");
      }

      // Create a new cancel token for the current search
      const newCancelToken = axios.CancelToken.source();
      setCancelToken(newCancelToken);

      // Make the API call to search for games on IGDB through your server
      const response = await axios.post(
        `${rootPath}api/igdb/search`,
        {
          searchKeyword,
        },
        { cancelToken: newCancelToken.token } // Attach the cancel token to the request
      );

      // Update search results
      setSearchResults(response.data);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Request canceled:", error.message);
      } else {
        console.error("Error searching for games:", error);
      }
    } finally {
      // Reset searching state and cancel token
      setSearching(false);
      setCancelToken(null);
    }
  };

  const handleInputChange = (value) => {
    // Update the search keyword
    setSearchKeyword(value);
  };

  useEffect(() => {
    // Start searching automatically if the user types more than 3 letters
    if (searchKeyword.length > 3) {
      // Set searching state to true
      setSearching(true);

      // Clear any existing timer
      if (searchTimer) {
        clearTimeout(searchTimer);
      }

      // Start a new timer to wait for 3 seconds before calling fetchGamesByKeyword
      setSearchTimer(
        setTimeout(() => {
          fetchGamesByKeyword(searchKeyword.trim());
        }, 1000)
      );
    }
  }, [searchKeyword]);

  const handleClearSearch = () => {
    // Trigger the API call to fetch all games
    setSearchKeyword("");
    setSearchResults(null);

    // Set searching state to false
    setSearching(false);
  };

  const handleAddGame = async (game) => {
    try {
      setLoading(true); // Set loading to true before making the API call
      // Make the API call to store game details
      const response = await axios.post(
        `${rootPath}api/game/store`,
        {
          gameDetails: {
            id: game.id,
            name: game.name,
            first_release_date: game.first_release_date,
            slug: game.slug,
            storyline: game.storyline,
            summary: game.summary,
            igdb_url: game.url,
            coverUrl: game.coverUrl,
          },
        }
      );

      // Redirect to the game details page using the gameId from the response
      const gameId = response.data.gameId;
      navigate(`/game/${gameId}`);
    } catch (error) {
      console.error("Error adding game:", error);

      toast.error("Error adding game. Please try again.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoading(false); // Set loading to false after the API call completes
    }
  };

  return (
    <>
      {loading && (
        <Backdrop
          sx={{
            color: "#fff",
            zIndex: (theme) =>
              Math.max.apply(Math, Object.values(theme.zIndex)) + 1,
          }}
          open={loading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
      <Box sx={{ width: "100%", typography: "body1" }}>
        <TabContext value={value}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <TabList onChange={handleChange} aria-label="lab API tabs example">
              <Tab label="From IGDB" value="1" />
              <Tab label="Manually" value="2" />
              <Tab label="From CSV" value="3" />
            </TabList>
          </Box>
          <TabPanel value="1">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Grid item xs={12}>
                  <TextField
                    label="Search games on IGDB"
                    variant="outlined"
                    value={searchKeyword}
                    // onChange={(e) => setSearchKeyword(e.target.value)}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Enter game name"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon style={{ cursor: "pointer" }} />
                        </InputAdornment>
                      ),
                      endAdornment: searchKeyword && (
                        <InputAdornment
                          position="end"
                          onClick={handleClearSearch}
                        >
                          <ClearIcon style={{ cursor: "pointer" }} />
                        </InputAdornment>
                      ),
                    }}
                    fullWidth
                    style={{ height: "56px" }}
                  />
                </Grid>
              </Grid>
              <Grid item xs={12}>
                {searching ? (
                  <Grid item xs={12}>
                    Searching...
                  </Grid>
                ) : !searchResults ? (
                  <Grid item xs={12}>
                    Please search for some games
                  </Grid>
                ) : searchKeyword !== "" && searchResults.length === 0 ? (
                  <Grid item xs={12}>
                    No games found
                  </Grid>
                ) : (
                  <Grid
                    container
                    spacing={2}
                    justifyContent="center"
                    alignItems="center"
                  >
                    {searchResults.map((game) => {
                      const isGameAdded =
                        find(gameIDs, { igdb_id: game.id }) !== undefined;
                      const gameId = isGameAdded
                        ? find(gameIDs, { igdb_id: game.id }).id
                        : null;

                      return (
                        <Grid
                          item
                          key={game.id}
                          xs={12}
                          sm={6}
                          md={4}
                          lg={3}
                          xl={2}
                        >
                          <GameCard
                            key={game.id}
                            game={game}
                            context={isGameAdded ? "added" : "add"}
                            contextFunction={() =>
                              isGameAdded
                                ? handleGameClick(gameId)
                                : handleAddGame(game)
                            }
                          />
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </Grid>
            </Grid>
          </TabPanel>
          <TabPanel value="2">Coming soon...</TabPanel>
          <TabPanel value="3">Coming soon...</TabPanel>
        </TabContext>
      </Box>
    </>
  );
};

export default AddGame;
