import { useState } from "react";
import { ModalContext } from "../context/ModalContext";

export interface ModalsProviderProps {
  children: React.ReactNode;
}

const ModalsProvider: React.FC<ModalsProviderProps> = ({ children }) => {
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(
    null
  );
  const [preventCloseOnOverlayClick, setPreventCloseOnOverlayClick] =
    useState<boolean>(false);

  const openModal = (content: React.ReactNode, preventClose = false) => {
    setModalContent(content);
    setPreventCloseOnOverlayClick(preventClose);
  };

  const closeAllModals = () => {
    setModalContent(null);
    setPreventCloseOnOverlayClick(false); // reset
  };

  const _getCurrentContent = () => {
    return modalContent;
  };

  return (
    <ModalContext.Provider
      value={{ openModal, closeAllModals, _getCurrentContent, modalContent }}
    >
      {children}
      {modalContent && (
        <div
          className="!fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50"
          onClick={() => !preventCloseOnOverlayClick && closeAllModals()}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {modalContent}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export default ModalsProvider;
