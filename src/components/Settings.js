import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import axios from "axios";
import { rootPath } from "../config/config";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SettingsPage = ({ closeIGDBErrorToast }) => {
  const theme = useTheme();
  const [igdbCredentials, setIgdbCredentials] = useState({
    clientId: "",
    clientSecret: "",
  });
  const [loading, setLoading] = useState(false);

  const fetchIDGBCredentials = async () => {
    try {
      const response = await axios.get(
        `${rootPath}api/igdb/credentials`
      );

      setIgdbCredentials(response.data);
    } catch (error) {
      console.error("Error fetching IGDB credentials:", error);
    }
  };

  const saveIDGBCredentials = async () => {
    try {
      setLoading(true); // Set loading to true before making the API call
      await axios.post(`${rootPath}api/igdb/credentials`, {
        clientId: igdbCredentials.clientId,
        clientSecret: igdbCredentials.clientSecret,
      });

      if (closeIGDBErrorToast) {
        closeIGDBErrorToast();
      }

      toast.success(`IGDB credentials saved successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error("Error saving IGDB credentials:", error);

      toast.error(`Error saving IGDB credentials. Please try again.`, {
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

  const testIDGBCredentials = async () => {
    try {
      setLoading(true); // Set loading to true before making the API call
      await axios.post(`${rootPath}api/igdb/test`, {
        clientId: igdbCredentials.clientId,
        clientSecret: igdbCredentials.clientSecret,
      });

      toast.success(`IGDB credentials authenticated successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error("Error authenticating IGDB credentials:", error);

      toast.error(`Error authenticating IGDB credentials. Please try again.`, {
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

  useEffect(() => {
    fetchIDGBCredentials();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setIgdbCredentials((prevCredentials) => ({
      ...prevCredentials,
      [name]: value,
    }));
  };

  const handleSave = () => {
    saveIDGBCredentials();
  };

  const handleTest = async () => {
    testIDGBCredentials();
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
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="igdb-credentials-content"
          id="igdb-credentials-header"
        >
          <Typography>IGDB Credentials</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="textSecondary">
            <strong>Note:</strong> To obtain IGDB credentials, please visit the{" "}
            <a
              href="https://api-docs.igdb.com/#getting-started"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.palette.text.primary }}
            >
              IGDB website
            </a>{" "}
            and create an account. Once logged in, you can generate your Client
            ID and Client Secret in the account settings.
          </Typography>
          <TextField
            label="Client ID"
            variant="outlined"
            name="clientId"
            value={igdbCredentials.clientId}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
            type="password"
          />
          <TextField
            label="Client Secret"
            variant="outlined"
            name="clientSecret"
            value={igdbCredentials.clientSecret}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
            type="password"
          />
          <Grid
            container
            spacing={2}
            justifyContent="center"
            alignItems="center"
          >
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                onClick={handleTest}
                disabled={
                  !igdbCredentials.clientId || !igdbCredentials.clientSecret
                }
              >
                Test
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={
                  !igdbCredentials.clientId || !igdbCredentials.clientSecret
                }
              >
                Save
              </Button>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </>
  );
};

export default SettingsPage;
