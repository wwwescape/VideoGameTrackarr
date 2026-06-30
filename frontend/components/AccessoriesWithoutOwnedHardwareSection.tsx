import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";
import { useAccessoriesWithoutOwnedHardware } from "../hooks/useInsights";
import { hardwareIdentifier } from "../utils/identifiers";
import VirtualList from "./VirtualList";

const AccessoriesWithoutOwnedHardwareSection = () => {
  const { data: accessories } = useAccessoriesWithoutOwnedHardware();

  if (!accessories || accessories.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No accessories found — every owned accessory is linked to hardware you own.
      </Typography>
    );
  }

  return (
    <VirtualList
      items={accessories}
      getKey={(accessory) => accessory.id}
      estimateSize={() => 80}
      gap={16}
      renderItem={(accessory) => (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            <Link to={`/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}`}>
              {accessory.officialName}
            </Link>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {accessory.manufacturerName}
          </Typography>
        </Paper>
      )}
    />
  );
};

export default AccessoriesWithoutOwnedHardwareSection;
