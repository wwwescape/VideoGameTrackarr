import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { rootPath } from "../config/config";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Badge from "@mui/material/Badge";
import Divider from "@mui/material/Divider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import TabContext from "@mui/lab/TabContext";
import TabList from "@mui/lab/TabList";
import TabPanel from "@mui/lab/TabPanel";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import RemoveIcon from "@mui/icons-material/Remove";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarIcon from "@mui/icons-material/Star";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import FormLabel from "@mui/material/FormLabel";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import GameCard from "./GameCard";
import EnhancedTable from "./EnhancedTable";
import { getReleaseYear } from "../utils/utils";
import { getAddonType } from "../utils/utils";
import { useTheme } from "@mui/material/styles";
import { styled } from "@mui/material/styles";
import { red, purple } from "@mui/material/colors";

const RemoveGameButton = styled(Button)(({ theme }) => ({
  color: theme.palette.getContrastText(red[500]),
  backgroundColor: red[500],
  "&:hover": {
    backgroundColor: red[700],
  },
}));

const ResyncGameButton = styled(Button)(({ theme }) => ({
  color: theme.palette.getContrastText(purple[500]),
  backgroundColor: purple[500],
  "&:hover": {
    backgroundColor: purple[700],
  },
}));

const GameDetails = () => {
  const theme = useTheme();

  const [gameOrAddonDetails, setGameDetails] = useState(null);
  const [allPlatforms, setAllPlatforms] = useState([]);
  const [allRegions, setAllRegions] = useState([]);
  const [collections, setCollections] = useState([]);
  const [wishlists, setWishlists] = useState([]);
  const [addons, setAddons] = useState([]);
  const [wishlisted, setWishlisted] = useState(0);
  const [owned, setOwned] = useState(0);
  const [statusType, setStatusType] = useState("");
  const [selected, setSelected] = useState(null);
  const [
    openAddGameStatusConfirmationDialog,
    setOpenAddGameStatusConfirmationDialog,
  ] = useState(false);
  const [
    openRemoveGameStatusConfirmationDialog,
    setOpenRemoveGameStatusConfirmationDialog,
  ] = useState(false);
  const [
    openMoveGameStatusConfirmationDialog,
    setOpenMoveGameStatusConfirmationDialog,
  ] = useState(false);
  const [
    openRemoveGameConfirmationDialog,
    setOpenRemoveGameConfirmationDialog,
  ] = useState(false);
  const [
    openResyncGameConfirmationDialog,
    setOpenResyncGameConfirmationDialog,
  ] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { gameOrAddonId, tab } = useParams();

  const initialTabValue = tab || "1";
  const [value, setValue] = useState(initialTabValue);
  const [platform, setPlatform] = useState(null);
  const [region, setRegion] = useState(null);
  const [edition, setEdition] = useState("");
  const [format, setFormat] = useState(1);
  const [gameStatusId, setGameStatusId] = useState(null);

  // Listen for changes in the tab parameter and update the component state
  useEffect(() => {
    setValue(tab || "1");
  }, [tab]);

  const fetchGameDetails = async () => {
    try {
      const response = await axios.get(`${rootPath}api/game/${gameOrAddonId}`);
      setGameDetails(response.data);
      setWishlisted(response.data.wishlisted);
      setOwned(response.data.owned);
    } catch (error) {
      console.error("Error fetching game details:", error);
    }
  };

  const fetchAllPlatforms = async () => {
    try {
      const response = await axios.get(`${rootPath}api/platforms`);
      setAllPlatforms(response.data);
    } catch (error) {
      console.error("Error fetching all platforms:", error);
    }
  };

  const fetchAllRegions = async () => {
    try {
      const response = await axios.get(`${rootPath}api/regions`);
      setAllRegions(response.data);
    } catch (error) {
      console.error("Error fetching all platforms:", error);
    }
  };

  const fetchGameCollections = async () => {
    try {
      const response = await axios.get(
        `${rootPath}api/game/status/${gameOrAddonId}/collection`
      );
      setCollections(response.data);
    } catch (error) {
      console.error("Error fetching collections:", error);
    }
  };

  const fetchGameWishlists = async () => {
    try {
      const response = await axios.get(
        `${rootPath}api/game/status/${gameOrAddonId}/wishlist`
      );
      setWishlists(response.data);
    } catch (error) {
      console.error("Error fetching wishlists:", error);
    }
  };

  const fetchAddons = async () => {
    try {
      const response = await axios.get(
        `${rootPath}api/game/addons/${gameOrAddonId}`
      );
      setAddons(response.data);
    } catch (error) {
      console.error("Error fetching addons:", error);
    }
  };

  useEffect(() => {
    fetchAllPlatforms();
    fetchAllRegions();
    fetchGameDetails();
    fetchGameCollections();
    fetchGameWishlists();
    fetchAddons();
  }, [gameOrAddonId]);

  const handleOpenAddGameStatusConfirmationDialog = () => {
    setOpenAddGameStatusConfirmationDialog(true);
  };

  const handleCloseAddGameStatusConfirmationDialog = () => {
    setPlatform(null);
    setRegion(null);
    setEdition(null);
    setFormat(1);
    setGameStatusId(null);
    setOpenAddGameStatusConfirmationDialog(false);
  };

  const handleOpenRemoveGameStatusConfirmationDialog = () => {
    setOpenRemoveGameStatusConfirmationDialog(true);
  };

  const handleCloseRemoveGameStatusConfirmationDialog = () => {
    setOpenRemoveGameStatusConfirmationDialog(false);
  };

  const handleOpenMoveGameStatusConfirmationDialog = () => {
    setOpenMoveGameStatusConfirmationDialog(true);
  };

  const handleCloseMoveGameStatusConfirmationDialog = () => {
    setOpenMoveGameStatusConfirmationDialog(false);
  };

  const handleOpenRemoveGameConfirmationDialog = () => {
    setOpenRemoveGameConfirmationDialog(true);
  };

  const handleCloseRemoveGameConfirmationDialog = () => {
    setOpenRemoveGameConfirmationDialog(false);
  };

  const handleOpenResyncGameConfirmationDialog = () => {
    setOpenResyncGameConfirmationDialog(true);
  };

  const handleCloseResyncGameConfirmationDialog = () => {
    setOpenResyncGameConfirmationDialog(false);
  };

  const handleAddonClick = (addonId) => {
    // Redirect to the game details page using the game ID
    navigate(`/addon/${addonId}/1`);
  };

  const handleRemoveGame = async () => {
    try {
      setLoading(true); // Set loading to true before making the API call
      // Make the API call to remove game
      await axios.delete(`${rootPath}api/game/${gameOrAddonId}`);

      navigate(`/`);
    } catch (error) {
      console.error("Error removing game:", error);

      toast.error("Error removing game. Please try again.", {
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

  const handleResyncGame = async () => {
    try {
      setLoading(true); // Set loading to true before making the API call
      // Make the API call to resync game
      await axios.put(
        `${rootPath}api/game/resync/${gameOrAddonDetails.igdb_id}`
      );

      fetchGameDetails();
      fetchAddons();
      handleCloseResyncGameConfirmationDialog();

      toast.success("Game resynced successfully!", {
        position: "top-right",
        autoClose: 3000, // 3 seconds
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error("Error resyncing game:", error);

      toast.error("Error resyncing game. Please try again.", {
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

  const headCells = [
    {
      id: "platform",
      numeric: false,
      disablePadding: false,
      label: "Platform",
      disableHeader: false,
    },
    {
      id: "region",
      numeric: false,
      disablePadding: false,
      label: "Region",
      disableHeader: false,
    },
    {
      id: "edition",
      numeric: false,
      disablePadding: false,
      label: "Edition",
      disableHeader: false,
    },
    {
      id: "format",
      numeric: false,
      disablePadding: false,
      label: "Format",
      disableHeader: false,
    },
    {
      id: "move",
      numeric: false,
      disablePadding: true,
      label: "Move",
      disableHeader: true,
    },
    {
      id: "edit",
      numeric: false,
      disablePadding: true,
      label: "Edit",
      disableHeader: true,
    },
    {
      id: "delete",
      numeric: false,
      disablePadding: true,
      label: "Delete",
      disableHeader: true,
    },
  ];

  // Update the URL parameter when the tab changes
  const handleTabChange = (event, newValue) => {
    setValue(newValue);
    navigate(`/${isAddon ? "addon" : "game"}/${gameOrAddonId}/${newValue}`, {
      replace: true,
    });
  };

  const handleAddClick = (tableName) => {
    // Set the status type
    setStatusType(tableName);
    // Open the confirmation dialog
    handleOpenAddGameStatusConfirmationDialog();
  };

  const handleDeleteClick = (selected, tableName) => {
    // Set the status type
    setStatusType(tableName);
    // Set the selected records
    setSelected(selected);
    // Open the confirmation dialog
    handleOpenRemoveGameStatusConfirmationDialog();
  };

  const handleMoveClick = (selected, tableName) => {
    // Set the status type
    setStatusType(tableName === "collection" ? "wishlist" : "collection");

    const gameStatus = [...collections, ...wishlists].find(
      (gameStatus) => gameStatus.id === selected
    );

    // Set gameStatusId
    setGameStatusId(gameStatus.id);

    // Open the confirmation dialog
    handleOpenMoveGameStatusConfirmationDialog();
  };

  const handleEditClick = (selected, tableName) => {
    // Set the status type
    setStatusType(tableName);

    const gameStatus = [...collections, ...wishlists].find(
      (gameStatus) => gameStatus.id === selected
    );

    // Set gameStatusId
    setGameStatusId(gameStatus.id);

    setPlatform(gameStatus.platform_id);
    setRegion(gameStatus.region_id);
    setEdition(gameStatus.edition);
    setFormat(gameStatus.format_id);

    // Open the confirmation dialog
    handleOpenAddGameStatusConfirmationDialog();
  };

  if (!gameOrAddonDetails) {
    return <>Loading...</>;
  }

  const isAddon = !(
    gameOrAddonDetails.is_dlc === 0 &&
    gameOrAddonDetails.is_expansion === 0 &&
    gameOrAddonDetails.is_pack === 0
  );

  const handleAddGameStatus = async () => {
    if (gameStatusId) {
      try {
        setLoading(true);

        // Make the API call to remove game status based on selected game IDs
        await axios.put(`${rootPath}api/game/status/update`, {
          data: {
            gameStatusId,
            gameOrAddonId,
            platform,
            region,
            edition,
            format,
            statusType: statusType,
            parentGameId: gameOrAddonDetails.parent_game_id,
          },
        });

        fetchGameDetails();
        fetchGameCollections();
        fetchGameWishlists();

        // Close the confirmation dialog
        handleCloseAddGameStatusConfirmationDialog();

        // You may want to fetch updated data or update the UI accordingly

        toast.success(`Game updated in your ${statusType} successfully!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } catch (error) {
        console.error(`Error updating game in your ${statusType}:`, error);

        toast.error(
          `Error updating game in your ${statusType}. Please try again.`,
          {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);

        // Make the API call to remove game status based on selected game IDs
        await axios.post(`${rootPath}api/game/status/add`, {
          data: {
            gameOrAddonId,
            platform,
            region,
            edition,
            format,
            statusType: statusType,
            parentGameId: gameOrAddonDetails.parent_game_id,
          },
        });

        fetchGameDetails();
        fetchGameCollections();
        fetchGameWishlists();

        // Close the confirmation dialog
        handleCloseAddGameStatusConfirmationDialog();

        // You may want to fetch updated data or update the UI accordingly

        toast.success(`Game added to your ${statusType} successfully!`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } catch (error) {
        console.error(`Error adding game to your ${statusType}:`, error);

        toast.error(
          `Error adding game to your ${statusType}. Please try again.`,
          {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRemoveGameStatus = async () => {
    try {
      setLoading(true);

      // Make the API call to remove game status based on selected game IDs
      await axios.delete(`${rootPath}api/game/status/remove`, {
        data: {
          gameStatusIds: selected,
          statusType: statusType,
          gameOrAddonId,
          parentGameId: gameOrAddonDetails.parent_game_id,
        },
      });

      fetchGameDetails();
      fetchGameCollections();
      fetchGameWishlists();

      // Close the confirmation dialog
      handleCloseRemoveGameStatusConfirmationDialog();

      // You may want to fetch updated data or update the UI accordingly

      toast.success(`Game removed from your ${statusType} successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error(`Error removing game from your ${statusType}:`, error);

      toast.error(
        `Error removing game from your ${statusType}. Please try again.`,
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMoveGameStatus = async () => {
    try {
      setLoading(true);

      // Make the API call to remove game status based on selected game IDs
      await axios.put(`${rootPath}api/game/status/move`, {
        data: {
          gameStatusId: gameStatusId,
          statusType: statusType,
          gameOrAddonId,
          parentGameId: gameOrAddonDetails.parent_game_id,
        },
      });

      fetchGameDetails();
      fetchGameCollections();
      fetchGameWishlists();

      // Close the confirmation dialog
      handleCloseMoveGameStatusConfirmationDialog();

      // You may want to fetch updated data or update the UI accordingly

      toast.success(`Game moved to your ${statusType} successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error(`Error moving game from your ${statusType}:`, error);

      toast.error(
        `Error moving game to your ${statusType}. Please try again.`,
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Grid container spacing={3}>
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
        <Grid item xs={3}>
          <Card
            style={{
              width: `100%`,
              position: "relative",
              borderRadius: "10px",
              border: `1px solid ${theme.palette.text.primary}`,
            }}
          >
            {/* Top Left Overlay Icons */}
            {wishlisted || gameOrAddonDetails.wishlisted_addons ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  background: "rgba(255, 255, 255)",
                  borderRadius: "0 0 10px 0",
                }}
              >
                {gameOrAddonDetails.wishlisted_addons > 0 ? (
                  <Badge
                    badgeContent={gameOrAddonDetails.wishlisted_addons}
                    color="primary"
                    anchorOrigin={{
                      vertical: "bottom",
                      horizontal: "right",
                    }}
                  >
                    <IconButton>
                      <Tooltip title="Added to wishlist">
                        <>
                          <StarIcon style={{ color: "orange" }} />
                        </>
                      </Tooltip>
                    </IconButton>
                  </Badge>
                ) : (
                  <IconButton>
                    <Tooltip title="Added to wishlist">
                      <>
                        <StarIcon style={{ color: "orange" }} />
                      </>
                    </Tooltip>
                  </IconButton>
                )}
              </div>
            ) : null}

            {/* Top Right Overlay Icons */}
            {owned || gameOrAddonDetails.owned_addons ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  background: "rgba(255, 255, 255)",
                  borderRadius: "0 0 0 10px",
                }}
              >
                {gameOrAddonDetails.owned_addons > 0 ? (
                  <Badge
                    badgeContent={gameOrAddonDetails.owned_addons}
                    color="primary"
                    anchorOrigin={{
                      vertical: "bottom",
                      horizontal: "left",
                    }}
                  >
                    <IconButton>
                      <Tooltip title="Added to collection">
                        <>
                          <CheckCircleIcon style={{ color: "green" }} />
                        </>
                      </Tooltip>
                    </IconButton>
                  </Badge>
                ) : (
                  <IconButton>
                    <Tooltip title="Added to collection">
                      <>
                        <CheckCircleIcon style={{ color: "green" }} />
                      </>
                    </Tooltip>
                  </IconButton>
                )}
              </div>
            ) : null}
            <Tooltip title={gameOrAddonDetails.name}>
              <CardMedia
                component="img"
                alt={gameOrAddonDetails.title}
                image={gameOrAddonDetails.coverUrl}
              />
            </Tooltip>
          </Card>
        </Grid>
        <Grid item xs={9}>
          <Card>
            <Box sx={{ width: "100%", typography: "body1" }}>
              <TabContext value={value}>
                <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                  <TabList
                    onChange={handleTabChange}
                    aria-label="lab API tabs example"
                  >
                    <Tab
                      label={`${!isAddon ? "Game" : "Addon"} Information`}
                      value="1"
                    />
                    <Tab label="Actions" value="2" />
                    {!isAddon ? <Tab label="Addons" value="3" /> : null}
                  </TabList>
                </Box>
                <TabPanel value="1">
                  <CardContent>
                    <Typography variant="h5" component="div">
                      {gameOrAddonDetails.name}{" "}
                      <Typography
                        variant="subtitle2"
                        color="textSecondary"
                        component="span"
                      >
                        ({getReleaseYear(gameOrAddonDetails.first_release_date)}
                        )
                      </Typography>
                    </Typography>
                    {isAddon ? (
                      <Typography
                        variant="subtitle1"
                        color="textSecondary"
                        component="span"
                      >
                        {getAddonType(gameOrAddonDetails)} for{" "}
                        <a
                          href={`/game/${gameOrAddonDetails.parent_game_id}/1`}
                          style={{ color: theme.palette.text.primary }}
                        >
                          {gameOrAddonDetails.parent_game_name}
                        </a>
                      </Typography>
                    ) : null}
                  </CardContent>
                  <Divider />
                  <CardContent>
                    {gameOrAddonDetails.summary && (
                      <Typography variant="body1" component="div">
                        {gameOrAddonDetails.summary}
                      </Typography>
                    )}
                  </CardContent>
                  <Divider />
                  <CardContent>
                    <Typography variant="body2" component="div">
                      <Tooltip title="View more details on IGDB.com">
                        <a
                          href={gameOrAddonDetails.igdb_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: theme.palette.text.primary }}
                        >
                          <img
                            src={"/images/igdb.png"}
                            alt="View more details on IGDB.com"
                            style={{ width: "64px" }}
                          />
                        </a>
                      </Tooltip>
                    </Typography>
                  </CardContent>
                </TabPanel>
                <TabPanel value="2">
                  <CardContent>
                    <EnhancedTable
                      rows={collections}
                      headCells={headCells}
                      tableName="Collection"
                      tableIcon={<CheckCircleIcon style={{ color: "green" }} />}
                      onAddClick={handleAddClick}
                      onDeleteClick={handleDeleteClick}
                      onMoveClick={handleMoveClick}
                      moveDirection="down"
                      onEditClick={handleEditClick}
                    />
                    <EnhancedTable
                      rows={wishlists}
                      headCells={headCells}
                      tableName="Wishlist"
                      tableIcon={<StarIcon style={{ color: "orange" }} />}
                      onAddClick={handleAddClick}
                      onDeleteClick={handleDeleteClick}
                      onMoveClick={handleMoveClick}
                      moveDirection="up"
                      onEditClick={handleEditClick}
                    />
                    {/* Add Game Status Confirmation Dialog */}
                    <Dialog
                      open={openAddGameStatusConfirmationDialog}
                      onClose={handleCloseAddGameStatusConfirmationDialog}
                      fullWidth
                      maxWidth="md"
                    >
                      <DialogTitle>
                        {gameStatusId
                          ? `Update game in your ${statusType}`
                          : `Add game to your ${statusType}`}
                      </DialogTitle>
                      <DialogContent>
                        <FormControl
                          required
                          fullWidth
                          sx={{ margin: "10px 0 20px 0" }}
                        >
                          <InputLabel htmlFor="platform">Platform</InputLabel>
                          <Select
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            label="Platform"
                          >
                            {allPlatforms.map((platform) => (
                              <MenuItem key={platform.id} value={platform.id}>
                                <ListItemText primary={platform.name} />
                              </MenuItem>
                            ))}
                          </Select>
                          <FormHelperText>Required</FormHelperText>
                        </FormControl>
                        <FormControl required fullWidth>
                          <InputLabel htmlFor="region">Region</InputLabel>
                          <Select
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            label="Region"
                          >
                            {allRegions.map((region) => (
                              <MenuItem key={region.id} value={region.id}>
                                <ListItemText primary={region.name} />
                              </MenuItem>
                            ))}
                          </Select>
                          <FormHelperText>Required</FormHelperText>
                        </FormControl>
                        <FormControl fullWidth sx={{ margin: "20px 0 20px 0" }}>
                          <TextField
                            fullWidth
                            label="Edition"
                            value={edition}
                            onChange={(e) => setEdition(e.target.value)}
                          />
                        </FormControl>
                        <FormControl fullWidth sx={{ margin: "10px 0 20px 0" }}>
                          <FormLabel id="format">Format</FormLabel>
                          <RadioGroup
                            row
                            aria-label="format"
                            name="format"
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                          >
                            <FormControlLabel
                              value={1}
                              control={<Radio />}
                              label="Physical"
                            />
                            <FormControlLabel
                              value={2}
                              control={<Radio />}
                              label="Digital"
                            />
                            <FormControlLabel
                              value={3}
                              control={<Radio />}
                              label="ISO"
                            />
                            <FormControlLabel
                              value={4}
                              control={<Radio />}
                              label="ROM"
                            />
                          </RadioGroup>
                        </FormControl>
                      </DialogContent>
                      <DialogActions>
                        <Button
                          onClick={handleCloseAddGameStatusConfirmationDialog}
                          color="primary"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddGameStatus}
                          color="primary"
                          disabled={!platform || !region}
                        >
                          {gameStatusId ? "Update" : "Add"}
                        </Button>
                      </DialogActions>
                    </Dialog>
                    {/* Remove Game Status Confirmation Dialog */}
                    <Dialog
                      open={openRemoveGameStatusConfirmationDialog}
                      onClose={handleCloseRemoveGameStatusConfirmationDialog}
                    >
                      <DialogTitle>{`Confirm Removal`}</DialogTitle>
                      <DialogContent>
                        <DialogContentText>
                          {`Are you sure you want to remove ${
                            selected?.length > 1 ? "these games" : "this game"
                          } from your
                          ${statusType}?`}
                        </DialogContentText>
                      </DialogContent>
                      <DialogActions>
                        <Button
                          onClick={
                            handleCloseRemoveGameStatusConfirmationDialog
                          }
                          color="primary"
                        >
                          Cancel
                        </Button>
                        <RemoveGameButton
                          onClick={handleRemoveGameStatus}
                          color="primary"
                        >
                          Remove
                        </RemoveGameButton>
                      </DialogActions>
                    </Dialog>
                    {/* Move Game Confirmation Dialog */}
                    <Dialog
                      open={openMoveGameStatusConfirmationDialog}
                      onClose={handleCloseMoveGameStatusConfirmationDialog}
                    >
                      <DialogTitle>{"Confirm Move"}</DialogTitle>
                      <DialogContent>
                        <DialogContentText>
                          {`Are you sure you want to move this game to your ${statusType}?`}
                        </DialogContentText>
                      </DialogContent>
                      <DialogActions>
                        <Button
                          onClick={handleCloseMoveGameStatusConfirmationDialog}
                          color="primary"
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleMoveGameStatus} color="primary">
                          Move
                        </Button>
                      </DialogActions>
                    </Dialog>
                  </CardContent>
                  <Divider />
                  <CardContent>
                    {!isAddon ? (
                      <Grid
                        container
                        spacing={2}
                        justifyContent="center"
                        alignItems="center"
                      >
                        <Grid item>
                          <ResyncGameButton
                            variant="contained"
                            startIcon={<RefreshIcon />}
                            onClick={handleOpenResyncGameConfirmationDialog}
                            fullWidth
                          >
                            Resync Game
                          </ResyncGameButton>
                          {/* Remove Game Confirmation Dialog */}
                          <Dialog
                            open={openResyncGameConfirmationDialog}
                            onClose={handleCloseResyncGameConfirmationDialog}
                          >
                            <DialogTitle>{"Confirm Resync"}</DialogTitle>
                            <DialogContent>
                              <DialogContentText>
                                Are you sure you want to resync this game?
                              </DialogContentText>
                            </DialogContent>
                            <DialogActions>
                              <Button
                                onClick={
                                  handleCloseResyncGameConfirmationDialog
                                }
                                color="primary"
                              >
                                Cancel
                              </Button>
                              <RemoveGameButton
                                onClick={handleResyncGame}
                                color="primary"
                              >
                                Resync
                              </RemoveGameButton>
                            </DialogActions>
                          </Dialog>
                        </Grid>
                        <Grid item>
                          <RemoveGameButton
                            variant="contained"
                            startIcon={<RemoveIcon />}
                            onClick={handleOpenRemoveGameConfirmationDialog}
                            fullWidth
                          >
                            Remove Game
                          </RemoveGameButton>
                          {/* Remove Game Confirmation Dialog */}
                          <Dialog
                            open={openRemoveGameConfirmationDialog}
                            onClose={handleCloseRemoveGameConfirmationDialog}
                          >
                            <DialogTitle>{"Confirm Removal"}</DialogTitle>
                            <DialogContent>
                              <DialogContentText>
                                Are you sure you want to remove this game?
                              </DialogContentText>
                            </DialogContent>
                            <DialogActions>
                              <Button
                                onClick={
                                  handleCloseRemoveGameConfirmationDialog
                                }
                                color="primary"
                              >
                                Cancel
                              </Button>
                              <RemoveGameButton
                                onClick={handleRemoveGame}
                                color="primary"
                              >
                                Remove
                              </RemoveGameButton>
                            </DialogActions>
                          </Dialog>
                        </Grid>
                      </Grid>
                    ) : null}
                  </CardContent>
                </TabPanel>
                {!isAddon ? (
                  <TabPanel value="3">
                    <Grid
                      container
                      spacing={2}
                      justifyContent="center"
                      alignItems="center"
                    >
                      {addons.length === 0 ? (
                        <Grid item xs={12}>
                          No addons found
                        </Grid>
                      ) : (
                        <>
                          {addons.map((addon) => (
                            <Grid item key={addon.id}>
                              <GameCard
                                key={addon.id}
                                game={addon}
                                context="addon"
                                contextFunction={() => {
                                  handleAddonClick(addon.id);
                                }}
                              />
                            </Grid>
                          ))}
                        </>
                      )}
                    </Grid>
                  </TabPanel>
                ) : null}
              </TabContext>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </>
  );
};

export default GameDetails;
