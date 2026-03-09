import { useMemo, useState } from "react";
import { SupportCenterContext } from "../context/SupportCenterContext";
import { useLocalStorage } from "usehooks-ts";
import { SupportQueue } from "../types";

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
  const [queues, setQueues] = useState<SupportQueue[] | null>(null);

  const selectedQueueObject = useMemo(() => {
    return queues?.find((queue) => queue.slug === selectedQueue) || null;
  }, [queues, selectedQueue]);

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
        queues,
        setQueues,
      }}
    >
      {children}
    </SupportCenterContext.Provider>
  );
};

export default SupportCenterProvider;
