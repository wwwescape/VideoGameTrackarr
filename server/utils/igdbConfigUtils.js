const fs = require("fs");
const path = require("path");

const configPath = path.resolve(__dirname, "../config/igdbConfig.json");

const readConfig = () => {
  try {
    const data = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading IGDB config:", error);
    return {};
  }
};

const writeConfig = (config) => {
  try {
    const data = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, data);
  } catch (error) {
    console.error("Error writing IGDB config:", error);
  }
};

module.exports = {
  readConfig,
  writeConfig,
};
