import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated } from "../api/auth";

// Presence-check only — a present-but-expired/invalid token still gets past this guard,
// but the first API call then 401s and apiClient's interceptor (api/client.ts) redirects
// to /login. This avoids a synchronous network round-trip just to render the route, at
// the cost of a possible one-request flash before the redirect.
const ProtectedLayout = () => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
};

export default ProtectedLayout;
