import { Fragment, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { settingsGeneralPage, settingsPages } from "../navigation/destinations";
import Page, { ToolbarButton, ToolbarDivider } from "./Page";

interface SettingsFrameProps {
  // A short explanation of the page, shown above its content.
  description?: ReactNode;
  // The page's own actions, at the right of the tabs (Steam Sync's Run import).
  toolbarEnd?: ReactNode;
  children: ReactNode;
}

// Every Settings page: the page frame with Settings' sub-pages as toolbar tabs, so they're one
// click apart on any screen size (the sidebar lists them too).
const SettingsFrame = ({ description, toolbarEnd, children }: SettingsFrameProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <Page
      toolbar={[settingsGeneralPage, ...settingsPages()].map((page) => (
        <Fragment key={page.to}>
          {page.separatorBefore ? <ToolbarDivider /> : null}
          <ToolbarButton
            to={page.to}
            icon={page.icon}
            label={t(page.labelKey)}
            active={pathname === page.to}
          />
        </Fragment>
      ))}
      toolbarEnd={toolbarEnd}
    >
      {description ? (
        <Box sx={{ color: "text.secondary", typography: "body2", mb: 2.5, maxWidth: 900 }}>
          {description}
        </Box>
      ) : null}
      {children}
    </Page>
  );
};

export default SettingsFrame;
