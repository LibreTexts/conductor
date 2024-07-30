import { createContext, useContext, ReactNode } from "react";

interface ModalContextProps {
  openModal: (content: ReactNode, preventClose?: boolean) => void;
  closeAllModals: () => void;
  _getCurrentContent: () => ReactNode | null;
  preventCloseOnOverlayClick?: boolean;
  modalContent: ReactNode | null;
}

export const ModalContext = createContext<ModalContextProps | undefined>(
  undefined
);

export const useModals = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};
