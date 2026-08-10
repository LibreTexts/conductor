import { useEffect } from "react";
import { useSupportCenterContext } from "../context/SupportCenterContext";
import useSupportQueues from "../hooks/useSupportQueues";

/**
 * Side-effect-only loader: fetches support queues and hydrates SupportCenterContext.
 * Renders nothing. Mount it only on routes that actually need queue data
 * (support/insight) so the query does not run app-wide. It must NOT wrap the
 * route <Switch> children — doing so collapses them into a single non-Route
 * node and breaks Switch's "first match wins" exclusivity.
 */
const SupportCenterDataLoader = () => {
  const { setQueues } = useSupportCenterContext();
  const { data } = useSupportQueues({ withCount: false });

  useEffect(() => {
    if (data) {
      setQueues(data);
    }
  }, [data, setQueues]);

  return null;
};

export default SupportCenterDataLoader;
