const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const { promisify } = require("util");
const readFileAsync = promisify(fs.readFile);
const { readConfig, writeConfig } = require("./utils/igdbConfigUtils");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = 3001; // or any port you prefer

app.use(bodyParser.json());

// Use the cors middleware
app.use(cors());

// Connect to SQLite database
const dbPath = "./db/videoGamerTrackarr.db";
const sqlFolderPath = "./db/sqls";

const db = new sqlite3.Database(dbPath);

// Function to execute SQL queries from a file
function executeSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf-8");
  return new Promise((resolve, reject) => {
    db.exec(sql, function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Function to check if migration is already executed
function isMigrationExecuted(migrationName) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT COUNT(*) as count FROM migrations WHERE name = ? AND executed = 1",
      [migrationName],
      (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      }
    );
  });
}

// Function to mark migration as executed
function markMigrationExecuted(migrationName) {
  return new Promise((resolve, reject) => {
    const now = Math.floor(Date.now() / 1000);
    db.run(
      "INSERT INTO migrations (name, executed, executed_on) VALUES (?, 1, ?) ON CONFLICT(name) DO UPDATE SET executed = 1, executed_on = ?",
      [migrationName, now, now],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Initialize the database if it doesn't exist
db.serialize(() => {
  // Execute the initialization SQL file
  executeSqlFile(`${sqlFolderPath}/initializeDb.sql`)
    .then(() => console.log("Database initialized successfully"))
    .catch((err) => console.error("Error initializing database:", err))
    .finally(() => {
      // Loop through migration files and execute if not already executed
      fs.readdirSync(sqlFolderPath).forEach(async (file) => {
        if (file.startsWith("migrations_") && file.endsWith(".sql")) {
          const migrationName = file.replace(/^migrations_|\.[^.]+$/g, "");
          const filePath = `${sqlFolderPath}/${file}`;

          const executed = await isMigrationExecuted(migrationName);

          if (!executed) {
            try {
              await executeSqlFile(filePath);
              await markMigrationExecuted(migrationName);
              console.log(`Migration ${migrationName} executed successfully`);
            } catch (err) {
              console.error(`Error executing migration ${migrationName}:`, err);
            }
          } else {
            console.log(
              `Migration ${migrationName} already executed, skipping`
            );
          }
        }
      });
    });
});

// Route for fetching IGDB credentials from the config
app.get("/api/igdb/credentials", async (req, res) => {
  try {
    const config = readConfig();

    const response = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching IGDB credentials:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route for IGDB game search
app.post("/api/igdb/credentials", async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body;

    // Read IGDB configuration from the JSON file
    const config = readConfig();

    config.clientId = clientId;
    config.clientSecret = clientSecret;

    writeConfig(config);

    res.json({
      success: true,
      message: "IGDB credentials saved successfully!",
    });
  } catch (error) {
    console.error("Error saving IGDB credentials:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route for IGDB authentication
app.post("/api/igdb/test", async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body;

    await axios.post("https://id.twitch.tv/oauth2/token", null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      },
    });

    res.json({
      success: true,
      message: "IGDB credentials authenticated successfully!",
    });
  } catch (error) {
    console.error("Error authenticating with IGDB:", error);

    switch (error.response.status) {
      case 400:
        res.status(400).json({ error: "IGDB credentials are invalid!" });
        break;
      case 500:
      default:
        res.status(500).json({ error: "Internal Server Error" });
        break;
    }
  }
});

// Route for IGDB authentication
app.post("/api/igdb/auth", async (req, res) => {
  try {
    const config = readConfig();

    if (!config.clientId || !config.clientSecret) {
      console.error("IGDB credentials missing!");
      res.status(400).json({ error: "IGDB credentials missing!" });
    } else {
      if (!config.accessToken) {
        const response = await axios.post(
          "https://id.twitch.tv/oauth2/token",
          null,
          {
            params: {
              client_id: config.clientId,
              client_secret: config.clientSecret,
              grant_type: "client_credentials",
            },
          }
        );

        const accessToken = response.data.access_token;

        // Update the access token in the configuration

        config.accessToken = accessToken;
        writeConfig(config);
      }

      // Send the access token back to the client
      res.json({ accessToken: config.accessToken });
    }
  } catch (error) {
    console.error("Error authenticating with IGDB:", error);

    switch (error.response.status) {
      case 400:
        res.status(400).json({ error: "IGDB credentials are invalid!" });
        break;
      case 500:
      default:
        res.status(500).json({ error: "Internal Server Error" });
        break;
    }
  }
});

// Route for IGDB game search
app.post("/api/igdb/search", async (req, res) => {
  try {
    const { searchKeyword } = req.body;

    // Read IGDB configuration from the JSON file
    const config = readConfig();

    // Check if we have a valid access token
    if (!config.accessToken) {
      console.error("Access token not found. Please authenticate with IGDB.");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Make the actual API call to IGDB to search for games
    const igdbResponse = await axios.post(
      "https://api.igdb.com/v4/games",
      `fields *;\r\nsearch "${searchKeyword}";where parent_game = null;limit 25;`,
      {
        headers: {
          "Client-ID": config.clientId,
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    // Extract the relevant data from the IGDB response
    const searchResults = igdbResponse.data;

    // Fetch cover images for each game
    const gameCovers = await Promise.all(
      searchResults.map(async (game) => {
        if (game.cover) {
          // Make a separate API call to get cover image details
          const coverResponse = await axios.post(
            "https://api.igdb.com/v4/covers",
            `fields url;\r\nwhere id = ${game.cover};`,
            {
              headers: {
                "Client-ID": config.clientId,
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "text/plain",
              },
            }
          );

          // Update the game object with cover URL
          game.coverUrl = coverResponse.data[0].url.replace(
            "t_thumb",
            "t_cover_big"
          );
        }

        return game;
      })
    );

    // Send the search results with cover URLs back to the client
    res.json(gameCovers);
  } catch (error) {
    console.error("Error making API call to IGDB:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route for fetching all game IDs from the local database
app.get("/api/games/ids", async (req, res) => {
  try {
    // Fetch all games from the local SQLite database
    const allGameIDs = await getAllGameIDsFromDatabase();

    res.json(allGameIDs);
  } catch (error) {
    console.error("Error fetching all game IDs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getAllGameIDsFromDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.all(
      `
    SELECT id, igdb_id FROM games
    `,
      [],
      function (error, rows) {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Route for fetching all games from the local database
app.get("/api/games", async (req, res) => {
  try {
    // Fetch all games from the local SQLite database
    const allGames = await getAllGamesFromDatabase();

    // Fetch cover URLs for each game
    const gameCovers = await Promise.all(
      allGames.map(async (game) => {
        try {
          const imagePath = `./covers/${game.igdb_id}.png`; // Assuming 'covers' folder exists

          // Read the image file asynchronously using fs.promises.readFile
          const data = await readFileAsync(imagePath, "base64");

          // Convert the image data to a data URI
          const base64Image = `data:image/jpeg;base64,${data}`;

          // Set coverUrl in game object
          game.coverUrl = base64Image;
        } catch (readError) {
          if (readError.code === "ENOENT") {
            // Handle the case when imagePath does not exist (file not found)
            console.warn("Image file not found for game ID", game.igdb_id);
          } else {
            console.error(readError);
          }
        }

        return game;
      })
    );

    res.json(gameCovers);
  } catch (error) {
    console.error("Error fetching all games:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getAllGamesFromDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT games.*
      FROM games
      WHERE games.parent_game_id IS NULL
      GROUP BY games.id
      ORDER By games.name
    `,
      [],
      function (error, rows) {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Route for searching games based on a keyword
app.post("/api/games/search", async (req, res) => {
  try {
    const { searchQuery } = req.body;

    // Fetch games from the local SQLite database based on the search query
    const searchResults = await searchGamesByKeyword(searchQuery);

    // Fetch cover URLs for each game
    const gameCovers = await Promise.all(
      searchResults.map(async (game) => {
        try {
          const imagePath = `./covers/${game.igdb_id}.png`; // Assuming 'covers' folder exists

          // Read the image file asynchronously using fs.promises.readFile
          const data = await readFileAsync(imagePath, "base64");

          // Convert the image data to a data URI
          const base64Image = `data:image/jpeg;base64,${data}`;

          // Set coverUrl in game object
          game.coverUrl = base64Image;
        } catch (readError) {
          if (readError.code === "ENOENT") {
            // Handle the case when imagePath does not exist (file not found)
            console.warn("Image file not found for game ID", game.igdb_id);
          } else {
            console.error(readError);
          }
        }

        return game;
      })
    );

    res.json(gameCovers);
  } catch (error) {
    console.error("Error searching games:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const searchGamesByKeyword = async (searchQuery) => {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT games.*
      FROM games
      WHERE games.name LIKE ? AND games.parent_game_id IS NULL
      GROUP BY games.id
      ORDER By games.name
      `,
      [`%${searchQuery}%`],
      function (error, rows) {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Route for storing game details in the local database
app.post("/api/game/store", async (req, res) => {
  try {
    const { gameDetails } = req.body;

    // Check if the gameDetails include a cover URL
    if (gameDetails.coverUrl) {
      await downloadAndStoreCover(gameDetails.id, gameDetails.coverUrl);
    }

    // Mark game as main game
    gameDetails.is_dlc = 0;
    gameDetails.is_expansion = 0;
    gameDetails.is_pack = 0;

    // Store game details in the local SQLite database
    const gameId = await storeGameDetailsInDatabase(gameDetails);

    // Read IGDB configuration from the JSON file
    const config = readConfig();

    // Check if we have a valid access token
    if (!config.accessToken) {
      console.error("Access token not found. Please authenticate with IGDB.");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch details and covers for dlcs and expansions
    const dlcExpansionResponse = await axios.post(
      "https://api.igdb.com/v4/games",
      `fields *;\r\nwhere parent_game = ${gameDetails.id} & category = (1,2,13);\r\nlimit 100;`,
      {
        headers: {
          "Client-ID": config.clientId,
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    // Check if there are items in the response
    if (dlcExpansionResponse.data && dlcExpansionResponse.data.length > 0) {
      // Loop through each item in the response
      for (const dlcExpansionGame of dlcExpansionResponse.data) {
        if (dlcExpansionGame.cover) {
          const coverResponse = await axios.post(
            "https://api.igdb.com/v4/covers",
            `fields url;\r\nwhere id = ${dlcExpansionGame.cover};`,
            {
              headers: {
                "Client-ID": config.clientId,
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "text/plain",
              },
            }
          );

          // Update the game object with cover URL
          dlcExpansionGame.coverUrl = coverResponse.data[0].url.replace(
            "t_thumb",
            "t_cover_big"
          );

          // Download and store the cover image locally
          await downloadAndStoreCover(
            dlcExpansionGame.id,
            dlcExpansionGame.coverUrl
          );
        }

        // Mark game as DLC
        if (dlcExpansionGame.category === 1) {
          dlcExpansionGame.is_dlc = 1;
        } else {
          dlcExpansionGame.is_dlc = 0;
        }

        // Mark game as an Expansion
        if (dlcExpansionGame.category === 2) {
          dlcExpansionGame.is_expansion = 1;
        } else {
          dlcExpansionGame.is_expansion = 0;
        }

        // Mark game as an Pack
        if (dlcExpansionGame.category === 13) {
          dlcExpansionGame.is_pack = 1;
        } else {
          dlcExpansionGame.is_pack = 0;
        }

        // Set the parent game ID
        dlcExpansionGame.parent_game_id = gameId;

        // Set the IGDB URL
        dlcExpansionGame.igdb_url = dlcExpansionGame.url;

        // Store game details in the local SQLite database
        await storeGameDetailsInDatabase(dlcExpansionGame);
      }
    }

    // Send the gameId back to the client
    res.json({ gameId });
  } catch (error) {
    console.error("Error storing game details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route for storing game details in the local database
app.put("/api/game/resync/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // Read IGDB configuration from the JSON file
    const config = readConfig();

    // Check if we have a valid access token
    if (!config.accessToken) {
      console.error("Access token not found. Please authenticate with IGDB.");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Make the actual API call to IGDB to search for the game
    const igdbResponse = await axios.post(
      "https://api.igdb.com/v4/games",
      `fields *;\r\nwhere id = ${id};`,
      {
        headers: {
          "Client-ID": config.clientId,
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    // Extract the relevant data from the IGDB response
    const gameDetails = igdbResponse.data[0];

    // Fetch cover image for the game
    if (gameDetails.cover) {
      // Make a separate API call to get cover image details
      const coverResponse = await axios.post(
        "https://api.igdb.com/v4/covers",
        `fields url;\r\nwhere id = ${gameDetails.cover};`,
        {
          headers: {
            "Client-ID": config.clientId,
            Authorization: `Bearer ${config.accessToken}`,
          },
        }
      );

      // Update the game object with cover URL
      gameDetails.coverUrl = coverResponse.data[0].url.replace(
        "t_thumb",
        "t_cover_big"
      );

      // Download and store the cover image locally
      await downloadAndStoreCover(gameDetails.id, gameDetails.coverUrl);
    }

    // Set the IGDB URL
    gameDetails.igdb_url = gameDetails.url;

    // Mark the game as the main game
    gameDetails.is_dlc = 0;
    gameDetails.is_expansion = 0;
    gameDetails.is_pack = 0;

    // Store game details in the local SQLite database
    const gameId = await storeGameDetailsInDatabase(gameDetails);

    // Fetch details and covers for DLCs and expansions
    const dlcExpansionResponse = await axios.post(
      "https://api.igdb.com/v4/games",
      `fields *;\r\nwhere parent_game = ${gameDetails.id} & category = (1,2,13);\r\nlimit 100;`,
      {
        headers: {
          "Client-ID": config.clientId,
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    // Check if there are items in the response
    if (dlcExpansionResponse.data && dlcExpansionResponse.data.length > 0) {
      // Loop through each item in the response
      for (const dlcExpansionGame of dlcExpansionResponse.data) {
        if (dlcExpansionGame.cover) {
          const coverResponse = await axios.post(
            "https://api.igdb.com/v4/covers",
            `fields url;\r\nwhere id = ${dlcExpansionGame.cover};`,
            {
              headers: {
                "Client-ID": config.clientId,
                Authorization: `Bearer ${config.accessToken}`,
              },
            }
          );

          // Update the game object with cover URL
          dlcExpansionGame.coverUrl = coverResponse.data[0].url.replace(
            "t_thumb",
            "t_cover_big"
          );

          // Download and store the cover image locally
          await downloadAndStoreCover(
            dlcExpansionGame.id,
            dlcExpansionGame.coverUrl
          );
        }

        // Mark the game as DLC
        if (dlcExpansionGame.category === 1) {
          dlcExpansionGame.is_dlc = 1;
        } else {
          dlcExpansionGame.is_dlc = 0;
        }

        // Mark the game as an Expansion
        if (dlcExpansionGame.category === 2) {
          dlcExpansionGame.is_expansion = 1;
        } else {
          dlcExpansionGame.is_expansion = 0;
        }

        // Mark the game as a Pack
        if (dlcExpansionGame.category === 13) {
          dlcExpansionGame.is_pack = 1;
        } else {
          dlcExpansionGame.is_pack = 0;
        }

        // Set the parent game ID
        dlcExpansionGame.parent_game_id = gameId;

        // Set the IGDB URL
        dlcExpansionGame.igdb_url = dlcExpansionGame.url;

        // Store game details in the local SQLite database
        await storeGameDetailsInDatabase(dlcExpansionGame);
      }
    }

    // Send the gameId back to the client
    res.json({ gameId });
  } catch (error) {
    console.error("Error storing game details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const storeGameDetailsInDatabase = async (gameDetails) => {
  return new Promise((resolve, reject) => {
    // Check if the record already exists
    db.get(
      "SELECT id FROM games WHERE igdb_id = ?",
      [gameDetails.id],
      (err, existingRecord) => {
        if (err) {
          reject(err);
          return;
        }

        if (existingRecord) {
          // Update the existing record
          db.run(
            "UPDATE games SET name = ?, first_release_date = ?, slug = ?, storyline = ?, summary = ?, igdb_url = ?, parent_game_id = ?, is_dlc = ?, is_expansion = ?, is_pack = ? WHERE igdb_id = ?",
            [
              gameDetails.name,
              gameDetails.first_release_date,
              gameDetails.slug,
              gameDetails.storyline,
              gameDetails.summary,
              gameDetails.igdb_url,
              gameDetails.parent_game_id,
              gameDetails.is_dlc,
              gameDetails.is_expansion,
              gameDetails.is_pack,
              gameDetails.id,
            ],
            function (error) {
              if (error) {
                reject(error);
              } else {
                resolve(this.changes > 0 ? existingRecord.id : null);
              }
            }
          );
        } else {
          // Insert a new record
          db.run(
            "INSERT INTO games (igdb_id, name, first_release_date, slug, storyline, summary, igdb_url, parent_game_id, is_dlc, is_expansion, is_pack) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              gameDetails.id,
              gameDetails.name,
              gameDetails.first_release_date,
              gameDetails.slug,
              gameDetails.storyline,
              gameDetails.summary,
              gameDetails.igdb_url,
              gameDetails.parent_game_id,
              gameDetails.is_dlc,
              gameDetails.is_expansion,
              gameDetails.is_pack,
            ],
            function (error) {
              if (error) {
                reject(error);
              } else {
                resolve(this.lastID);
              }
            }
          );
        }
      }
    );
  });
};

// Route for fetching all platforms from the database
app.get("/api/platforms", async (req, res) => {
  try {
    const allPlatforms = await getAllPlatformsFromDatabase();
    res.json(allPlatforms);
  } catch (error) {
    console.error("Error fetching all platforms:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getAllPlatformsFromDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM platforms ORDER By name", [], function (error, rows) {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });
  });
};

// Route for fetching all platforms from the database
app.get("/api/regions", async (req, res) => {
  try {
    const allRegions = await getAllRegionsFromDatabase();
    res.json(allRegions);
  } catch (error) {
    console.error("Error fetching all regions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getAllRegionsFromDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM regions ORDER By id", [], function (error, rows) {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });
  });
};

// Route for fetching game details from the local database
app.get("/api/game/:id", async (req, res) => {
  try {
    const gameId = req.params.id;

    // Fetch game details from the local SQLite database
    // const gameDetails = await getGameDetailsFromDatabase(gameId);
    const gameDetails = await getGameDetailsWithPlatformsFromDatabase(gameId);

    try {
      const imagePath = `./covers/${gameDetails.igdb_id}.png`; // Assuming 'covers' folder exists

      // Read the image file asynchronously using fs.promises.readFile
      const data = await readFileAsync(imagePath, "base64");

      // Convert the image data to a data URI
      const base64Image = `data:image/jpeg;base64,${data}`;

      // Set coverUrl in gameDetails
      gameDetails.coverUrl = base64Image;

      // Send the response with updated gameDetails
      res.json(gameDetails);
    } catch (readError) {
      if (readError.code === "ENOENT") {
        // Handle the case when imagePath does not exist (file not found)
        console.warn(
          "Image file not found. Returning gameDetails without coverUrl."
        );
        res.json(gameDetails);
      } else {
        console.error(readError);
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  } catch (error) {
    console.error("Error fetching game details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// const getGameDetailsFromDatabase = async (gameId) => {
//   return new Promise((resolve, reject) => {
//     db.get("SELECT * FROM games WHERE id = ?", [gameId], function (error, row) {
//       if (error) {
//         reject(error);
//       } else {
//         resolve(row);
//       }
//     });
//   });
// };

const getGameDetailsWithPlatformsFromDatabase = async (gameId) => {
  return new Promise((resolve, reject) => {
    // Use a JOIN query to fetch game details along with platforms
    db.get(
      `
      SELECT
        games.*,
        parentGame.name AS parent_game_name
      FROM games
      LEFT JOIN games AS parentGame ON games.parent_game_id = parentGame.id
      WHERE games.id = ?
      GROUP BY games.id
      ORDER BY games.name;
      `,
      [gameId],
      function (error, row) {
        if (error) {
          reject(error);
        } else {
          resolve(row);
        }
      }
    );
  });
};

// Route for removing a game by ID
app.delete("/api/game/:id", async (req, res) => {
  try {
    const gameId = req.params.id;

    // Delete the game from the local SQLite database
    await deleteGameFromDatabase(gameId);

    // Send a success response
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing game:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const deleteGameFromDatabase = async (gameId) => {
  return new Promise((resolve, reject) => {
    // Fetch all game details before deleting
    db.all(
      "SELECT * FROM games WHERE id = ? OR parent_game_id = ?",
      [gameId, gameId],
      async (error, rows) => {
        if (error) {
          reject(error);
          return;
        }

        // Delete the game entries from the database
        db.run(
          "DELETE FROM games WHERE id = ? OR parent_game_id = ?",
          [gameId, gameId],
          async (deleteError) => {
            if (deleteError) {
              reject(deleteError);
              return;
            }

            // Delete the corresponding cover images
            await Promise.all(
              rows.map(async (row) => {
                try {
                  const imagePath = `./covers/${row.igdb_id}.png`;

                  // Delete the file asynchronously using fs.promises.unlink
                  await fs.promises.unlink(imagePath);
                } catch (unlinkError) {
                  if (unlinkError.code === "ENOENT") {
                    // Handle the case when imagePath does not exist (file not found)
                    console.warn(
                      "Image file not found for game ID",
                      row.igdb_id
                    );
                  } else {
                    reject(unlinkError);
                  }
                }
              })
            );

            resolve();
          }
        );
      }
    );
  });
};

// Route for getting game addons by game ID
app.get("/api/game/addons/:id", async (req, res) => {
  try {
    const gameId = req.params.id;

    // Fetch DLCs and expansions from the local SQLite database based on the game ID
    const addons = await getAddonsByGameId(gameId);

    // Fetch cover URLs for each addon
    const addonCovers = await Promise.all(
      addons.map(async (addon) => {
        try {
          const imagePath = `./covers/${addon.igdb_id}.png`; // Assuming 'covers' folder exists

          // Read the image file asynchronously using fs.promises.readFile
          const data = await readFileAsync(imagePath, "base64");

          // Convert the image data to a data URI
          const base64Image = `data:image/jpeg;base64,${data}`;

          // Set coverUrl in addon object
          addon.coverUrl = base64Image;
        } catch (readError) {
          if (readError.code === "ENOENT") {
            // Handle the case when imagePath does not exist (file not found)
            console.warn("Image file not found for game ID", addon.igdb_id);
          } else {
            console.error(readError);
          }
        }

        return addon;
      })
    );

    res.json(addonCovers);
  } catch (error) {
    console.error("Error fetching addons:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getAddonsByGameId = async (gameId) => {
  return new Promise((resolve, reject) => {
    // Use a JOIN query to fetch addons for a given game ID
    db.all(
      `
      SELECT games.*
      FROM games
      WHERE (games.is_dlc = 1 OR games.is_expansion = 1 OR games.is_pack = 1) AND games.parent_game_id = ?
      GROUP BY games.id
      ORDER BY games.name
      `,
      [gameId],
      function (error, rows) {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

const statusTypeEnum = {
  collection: 1,
  wishlist: 2,
};

const formatTypeEnum = {
  1: "Physical",
  2: "Digital",
  3: "ISO",
  4: "ROM",
};

// Route for fetching game status
app.get("/api/game/status/:id/:statusType", async (req, res) => {
  try {
    const gameId = req.params.id;
    const statusType = statusTypeEnum[req.params.statusType];

    // Fetch game status from the local SQLite database
    const gameStatus = await getGameStatusFromDatabase(gameId, statusType);

    // Transform the result to the desired JSON format
    const formattedStatus = gameStatus.map((status) => ({
      id: status.id,
      platform_id: status.platform_id,
      platform: status.platform_name,
      region: status.region_name,
      region_id: status.region_id,
      edition: status.edition || "",
      format: formatTypeEnum[status.format],
      format_id: status.format,
    }));

    // Send the response with the formatted game status
    res.json(formattedStatus);
  } catch (error) {
    console.error("Error fetching game status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const getGameStatusFromDatabase = async (gameId, statusType) => {
  return new Promise((resolve, reject) => {
    // Use a JOIN query to fetch game status details
    db.all(
      `
      SELECT
        game_status.id,
        platforms.id AS platform_id,
        platforms.name AS platform_name,
        regions.id AS region_id,
        regions.name AS region_name,
        game_status.edition,
        game_status.format
      FROM game_status
      LEFT JOIN platforms ON game_status.platform_id = platforms.id
      LEFT JOIN regions ON game_status.region_id = regions.id
      WHERE game_status.game_id = ? AND game_status.status = ?
      `,
      [gameId, statusType],
      function (error, rows) {
        if (error) {
          reject(error);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Route to handle the removal of game status
app.delete("/api/game/status/remove", async (req, res) => {
  try {
    const { gameStatusIds, statusType, gameOrAddonId, parentGameId } = req.body;

    // Remove game status records from the local SQLite database
    await removeGameStatusFromDatabase(
      gameStatusIds,
      statusType,
      gameOrAddonId,
      parentGameId
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error removing game status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const removeGameStatusFromDatabase = async (
  gameStatusIds,
  statusType,
  gameOrAddonId,
  parentGameId
) => {
  return new Promise((resolve, reject) => {
    // Use a DELETE query to remove game status records
    db.run(
      `
      DELETE FROM game_status
      WHERE id IN (${gameStatusIds.join(",")}) AND status = ?
      `,
      [statusTypeEnum[statusType]],
      async function (error) {
        if (error) {
          reject(error);
        } else {
          await getGameStatusCountFromDatabase(
            gameOrAddonId,
            parentGameId,
            statusType,
            "remove"
          );

          resolve();
        }
      }
    );
  });
};

// Route for adding game status to the database
app.post("/api/game/status/add", async (req, res) => {
  const {
    gameOrAddonId,
    platform,
    region,
    edition,
    format,
    statusType,
    parentGameId,
  } = req.body.data;

  try {
    await addGameStatusToDatabase(
      gameOrAddonId,
      platform,
      region,
      edition,
      format,
      statusType,
      parentGameId
    );
    res.json({ success: true, message: "Game status added successfully" });
  } catch (error) {
    console.error("Error adding game status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const addGameStatusToDatabase = async (
  gameOrAddonId,
  platform,
  region,
  edition,
  format,
  statusType,
  parentGameId
) => {
  return new Promise((resolve, reject) => {
    // Adjust the SQL query based on your database structure
    const sql =
      "INSERT INTO game_status (game_id, platform_id, region_id, edition, format, status) VALUES (?, ?, ?, ?, ?, ?)";
    const params = [
      gameOrAddonId,
      platform,
      region,
      edition,
      format,
      statusTypeEnum[statusType],
    ];

    db.run(sql, params, async function (error) {
      if (error) {
        reject(error);
      } else {
        await updateGamesWithGameStatusInDatabase(
          gameOrAddonId,
          parentGameId,
          statusType
        );

        resolve({ id: this.lastID });
      }
    });
  });
};

// Route for updating game status in the database
app.put("/api/game/status/update", async (req, res) => {
  const {
    gameStatusId,
    platform,
    region,
    edition,
    format,
    statusType,
    gameOrAddonId,
    parentGameId,
  } = req.body.data;

  try {
    await updateGameStatusInDatabase(
      gameStatusId,
      platform,
      region,
      edition,
      format,
      statusType,
      gameOrAddonId,
      parentGameId
    );
    res.json({ success: true, message: "Game status updated successfully" });
  } catch (error) {
    console.error("Error updating game status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const updateGameStatusInDatabase = async (
  gameStatusId,
  platform,
  region,
  edition,
  format,
  statusType,
  gameOrAddonId,
  parentGameId
) => {
  return new Promise((resolve, reject) => {
    // Adjust the SQL query based on your database structure
    const sql =
      "UPDATE game_status set platform_id = ?, region_id = ?, edition = ?, format = ? WHERE id = ?";
    const params = [platform, region, edition, format, gameStatusId];

    db.run(sql, params, async function (error) {
      if (error) {
        reject(error);
      } else {
        await updateGamesWithGameStatusInDatabase(
          gameOrAddonId,
          parentGameId,
          statusType
        );

        resolve({ id: this.lastID });
      }
    });
  });
};

// Route for moving game status in the database
app.put("/api/game/status/move", async (req, res) => {
  const { gameStatusId, statusType, gameOrAddonId, parentGameId } =
    req.body.data;

  try {
    await moveGameStatusInDatabase(
      gameStatusId,
      statusType,
      gameOrAddonId,
      parentGameId
    );
    res.json({ success: true, message: "Game status moved successfully" });
  } catch (error) {
    console.error("Error moving game status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const moveGameStatusInDatabase = async (
  gameStatusId,
  statusType,
  gameOrAddonId,
  parentGameId
) => {
  return new Promise((resolve, reject) => {
    // Adjust the SQL query based on your database structure
    const sql = "UPDATE game_status set status = ? WHERE id = ?";
    const params = [statusTypeEnum[statusType], gameStatusId];

    db.run(sql, params, async function (error) {
      if (error) {
        reject(error);
      } else {
        await updateGamesWithGameStatusInDatabase(
          gameOrAddonId,
          parentGameId,
          statusType
        );

        resolve({ id: this.lastID });
      }
    });
  });
};

const updateGamesWithGameStatusInDatabase = async (
  gameOrAddonId,
  parentGameId,
  statusType
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE games SET ${
        statusTypeEnum[statusType] === statusTypeEnum.collection
          ? "owned"
          : "wishlisted"
      } = 1
      WHERE id = ?
    `;

    const params = [gameOrAddonId];

    db.run(sql, params, async function (error) {
      if (error) {
        reject(error);
      } else {
        await getGameStatusCountFromDatabase(gameOrAddonId, parentGameId);

        resolve({ id: this.lastID });
      }
    });
  });
};

const getGameStatusCountFromDatabase = async (gameOrAddonId, parentGameId) => {
  return new Promise((resolve, reject) => {
    const countSql = `
      SELECT
        SUM(CASE WHEN game_status.status = 1 THEN 1 ELSE 0 END) AS owned_count,
        SUM(CASE WHEN game_status.status = 2 THEN 1 ELSE 0 END) AS wishlisted_count
      FROM games
      JOIN game_status ON games.id = game_status.game_id WHERE games.id = ?;
    `;

    const countParams = [gameOrAddonId];

    db.get(countSql, countParams, (countError, row) => {
      if (countError) {
        reject(countError);
      } else {
        const owned_count = row.owned_count;
        const wishlisted_count = row.wishlisted_count;

        // Update games table based on the count
        const updateGamesSql = `
          UPDATE games SET owned = ${owned_count > 0 ? 1 : 0}, wishlisted = ${
            wishlisted_count > 0 ? 1 : 0
          }
          WHERE id = ?;
        `;

        const updateGamesParams = [gameOrAddonId];

        db.run(updateGamesSql, updateGamesParams, async function (updateError) {
          if (updateError) {
            reject(updateError);
          } else {
            await getAddonStatusCountFromDatabase(parentGameId);

            resolve(row);
          }
        });
      }
    });
  });
};

const getAddonStatusCountFromDatabase = async (parentGameId) => {
  return new Promise((resolve, reject) => {
    const countSql = `
      SELECT
        SUM(CASE WHEN game_status.status = 1 THEN 1 ELSE 0 END) AS owned_addons_count,
        SUM(CASE WHEN game_status.status = 2 THEN 1 ELSE 0 END) AS wishlisted_addons_count
      FROM games
      JOIN game_status ON games.id = game_status.game_id WHERE games.parent_game_id = ?;
    `;

    const countParams = [parentGameId];

    db.get(countSql, countParams, (countError, row) => {
      if (countError) {
        reject(countError);
      } else {
        const owned_addons_count = row.owned_addons_count;
        const wishlisted_addons_count = row.wishlisted_addons_count;

        // Update games table based on the count
        const updateGamesSql = `
          UPDATE games SET owned_addons = ${owned_addons_count}, wishlisted_addons = ${wishlisted_addons_count}
          WHERE id = ?;
        `;

        const updateGamesParams = [parentGameId];

        db.run(updateGamesSql, updateGamesParams, async function (updateError) {
          if (updateError) {
            reject(updateError);
          } else {
            resolve(row);
          }
        });
      }
    });
  });
};

const downloadAndStoreCover = async (gameId, coverUrl) => {
  try {
    // Download the image from the cover URL
    const imageResponse = await axios.get(`https:${coverUrl}`, {
      responseType: "arraybuffer",
    });

    if (imageResponse) {
      // Save the image to a local folder
      const imagePath = `./covers/${gameId}.png`; // Assuming 'covers' folder exists

      fs.writeFileSync(imagePath, Buffer.from(imageResponse.data));
    }
  } catch (error) {
    console.error(
      `Error downloading and storing cover for game ${gameId}:`,
      error
    );
    // You might want to throw the error here or handle it as per your application's needs
  }
};

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
