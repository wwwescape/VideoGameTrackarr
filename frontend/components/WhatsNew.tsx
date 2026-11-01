import { lazy, Suspense } from "react";
import { useWhatsNew } from "../hooks/useVersion";

// The dialog (and its Markdown renderer) only downloads on the one load after an upgrade
// that has something to show, keeping it out of every other page load.
const WhatsNewDialog = lazy(() => import("./WhatsNewDialog"));

const WhatsNew = () => {
  const { data } = useWhatsNew();
  if (!data || (data.releases.length === 0 && !data.notesUnavailable)) return null;
  return (
    <Suspense fallback={null}>
      <WhatsNewDialog />
    </Suspense>
  );
};

export default WhatsNew;
