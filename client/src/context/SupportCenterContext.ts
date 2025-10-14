import { createContext, Dispatch, SetStateAction, useContext } from "react";

export interface SupportCenterContextType {
  selectedQueue: string;
  setSelectedQueue: (queue: string) => void;
  selectedTickets: string[];
  setSelectedTickets: Dispatch<SetStateAction<string[]>>;
}

export const SupportCenterContext = createContext<
  SupportCenterContextType | undefined
>(undefined);

export const useSupportCenterContext = () => {
  const context = useContext(SupportCenterContext);
  if (!context) {
    throw new Error(
      "useSupportCenterContext must be used within a SupportCenterProvider"
    );
  }
  return context;
};
