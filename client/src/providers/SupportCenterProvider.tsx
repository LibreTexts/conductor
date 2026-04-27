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

  const [queueDrawerOpen, setQueueDrawerOpen] = useLocalStorage<boolean>(
    "support_queue_drawer_open",
    true,
    {
      serializer(value) {
        return JSON.stringify(value);
      },
      deserializer(value) {
        return value ? JSON.parse(value) : true;
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
        queueDrawerOpen,
        setQueueDrawerOpen,
      }}
    >
      {children}
    </SupportCenterContext.Provider>
  );
};

export default SupportCenterProvider;
