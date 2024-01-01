const getReleaseYear = (value) => {
  // Unix timestamp value
  const timestamp = value;

  // Convert the timestamp to milliseconds
  const milliseconds = timestamp * 1000;

  // Create a new Date object
  const date = new Date(milliseconds);

  // Get the year
  const year = date.getFullYear();

  return year;
};

const getAddonType = (gameOrAddon) => {
  if (gameOrAddon.is_dlc) {
    return "DLC";
  }

  if (gameOrAddon.is_expansion) {
    return "Expansion";
  }

  if (gameOrAddon.is_pack) {
    return "Pack";
  }
};

module.exports = {
  getReleaseYear,
  getAddonType,
};
