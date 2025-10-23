import { useMemo, useState } from "react";
import { SupportCenterContext } from "../context/SupportCenterContext";
import { useLocalStorage } from "usehooks-ts";
import useSupportQueues from "../hooks/useSupportQueues";

const SupportCenterProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedQueue, setSelectedQueue] = useLocalStorage<string>(
    "last_accessed_support_queue",
    "support",
    {
      serializer(value) {
        return value;
      },
      deserializer(value) {
        return value || "support";
      },
    }
  );
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);

  const { data, isFetching } = useSupportQueues({ withCount: false });

  const selectedQueueObject = useMemo(() => {
    return data?.find((queue) => queue.slug === selectedQueue) || null;
  }, [data, selectedQueue]);

  return (
    <SupportCenterContext.Provider
      value={{
        selectedQueue,
        setSelectedQueue,
        selectedTickets,
        setSelectedTickets,
        selectedQueueObject,
      }}
    >
      {children}
    </SupportCenterContext.Provider>
  );
};

export default SupportCenterProvider;
