import { useState } from "react";
import { SupportCenterContext } from "../context/SupportCenterContext";
import { useLocalStorage } from "usehooks-ts";

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

  return (
    <SupportCenterContext.Provider
      value={{
        selectedQueue,
        setSelectedQueue,
        selectedTickets,
        setSelectedTickets,
      }}
    >
      {children}
    </SupportCenterContext.Provider>
  );
};

export default SupportCenterProvider;
