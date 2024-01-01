import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { rootPath } from "../config/config";
import GameCard from "./GameCard";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";

const GameList = () => {
  const [games, setGames] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searching, setSearching] = useState(false); // State to track if a search is in progress
  const [cancelToken, setCancelToken] = useState(null); // Cancel token for Axios requests

  const navigate = useNavigate();

  const handleGameClick = (gameId) => {
    // Redirect to the game details page using the game ID
    navigate(`/game/${gameId}/1`);
  };

  useEffect(() => {
    // Fetch the list of all games when the component mounts
    fetchAllGames();
  }, []); // Empty dependency array ensures it runs only once on mount

  const fetchAllGames = async () => {
    try {
      // Make a request to your backend API to fetch all games
      const response = await axios.get(`${rootPath}api/games`);

      // Set the retrieved games in the state
      setGames(response.data);
    } catch (error) {
      console.error("Error fetching all games:", error);
    }
  };

  const fetchGamesByKeyword = async (keyword) => {
    try {
      // If there is an ongoing search, cancel it
      if (cancelToken) {
        cancelToken.cancel("Operation canceled due to new search.");
      }

      // Create a new cancel token for the current search
      const newCancelToken = axios.CancelToken.source();
      setCancelToken(newCancelToken);

      // Set searching state to true
      setSearching(true);

      // Make a request to your backend API to fetch games based on the keyword
      const response = await axios.post(
        `${rootPath}api/games/search`,
        {
          searchQuery: keyword,
        },
        { cancelToken: newCancelToken.token } // Attach the cancel token to the request
      );

      // Set the retrieved games in the state
      setGames(response.data);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Request canceled:", error.message);
      } else {
        console.error("Error fetching games by keyword:", error);
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

    // Start searching automatically if the user types more than 3 letters
    if (value.length > 3) {
      fetchGamesByKeyword(value);
    }
  };

  const handleClearSearch = () => {
    // Trigger the API call to fetch all games
    setSearchKeyword("");
    fetchAllGames();
  };

  // ... (you can include other functions related to game handling)

  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Grid item xs={12}>
            <TextField
              label="Search games"
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
                  <InputAdornment position="end" onClick={handleClearSearch}>
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
          {games === null ? (
            <Grid item xs={12}>
              Loading...
            </Grid>
          ) : searching ? (
            <Grid item xs={12}>
              Searching...
            </Grid>
          ) : searchKeyword !== "" && games.length === 0 ? (
            <Grid item xs={12}>
              No games found
            </Grid>
          ) : games.length === 0 ? (
            <Grid item xs={12}>
              Please add some games
            </Grid>
          ) : (
            <Grid
              container
              spacing={2}
              justifyContent="center"
              alignItems="center"
            >
              {games.map((game) => (
                <Grid item key={game.id}>
                  <GameCard
                    key={game.id}
                    game={game}
                    context="list"
                    contextFunction={() => {
                      handleGameClick(game.id);
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>
    </>
  );
};

export default GameList;
