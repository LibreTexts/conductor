import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { useNotifications } from "../context/NotificationContext";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Watches for a new release so users can reload on their own terms instead of discovering
 * it when a lazy chunk 404s mid-navigation. Checks at most once per interval, on navigation.
 *
 * Deliberately best-effort: every failure is swallowed. A broken or unreachable build
 * endpoint must never affect navigation.
 */
export default function useNewBuildCheck(): void {
  const location = useLocation();
  const { addNotification } = useNotifications();
  const knownRef = useRef<string | null>(null);
  const lastCheckedRef = useRef(0);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (Date.now() - lastCheckedRef.current < CHECK_INTERVAL_MS) return;
    lastCheckedRef.current = Date.now();

    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get("/build");
        const id = `${res.data?.version ?? ""}:${res.data?.ref ?? ""}`;
        if (cancelled || !id || id === ":") return;

        if (knownRef.current === null) {
          knownRef.current = id;
          return;
        }
        if (id !== knownRef.current && !notifiedRef.current) {
          notifiedRef.current = true;
          addNotification({
            type: "info",
            message:
              "A new version of Conductor is available. Reload the page when convenient to get the latest updates.",
            duration: 15000,
          });
        }
      } catch (e) {
        // Intentionally ignored: this is a convenience check, not a core path.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, addNotification]);
}
