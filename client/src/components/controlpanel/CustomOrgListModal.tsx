import React, { useEffect, useState } from "react";
import { Modal, Button } from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import TransferList from "../TransferList";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import LoadingSpinner from "../LoadingSpinner";
import axios from "axios";
import { useTypedSelector } from "../../state/hooks";
import { useDispatch } from "react-redux";

interface CustomOrgListModalProps {
  show: boolean;
  orgID: string;
  onClose: () => void;
  onSave: (selectedItems: string[]) => void;
  initCustomOrgList?: string[];
}

const CustomOrgListModal: React.FC<CustomOrgListModalProps> = ({
  show,
  orgID,
  onClose,
  onSave,
  initCustomOrgList,
}) => {
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState<boolean>(false);
  const [availbleItems, setAvailableItems] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    if (show) {
      loadDefaultOrgList();
      if (initCustomOrgList) {
        setSelectedItems(initCustomOrgList);
      }
    }
  }, [show, initCustomOrgList]);

  async function loadDefaultOrgList() {
    try {
      setLoading(true);
      const res = await api.getCentralIdentityADAPTOrgs({ limit: 1000 });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.orgs || !Array.isArray(res.data.orgs)) {
        throw new Error("Invalid response from server.");
      }
      setAvailableItems(res.data.orgs);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    try {
      setLoading(true);
      const res = await axios.put(`/org/${orgID}`, {
        customOrgList: selectedItems,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      dispatch({
        type: "SET_ORG_INFO",
        payload: {
          ...org,
          customOrgList: selectedItems,
        },
      });
      onSave(selectedItems);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="xl">
      <Modal.Header>
        <Modal.Title>Customize Org/Campus List</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && <LoadingSpinner />}
        <TransferList
          availableItems={availbleItems}
          setAvailableItems={setAvailableItems}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          allowManualEntry={true}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="primary"
          icon={<IconDeviceFloppy size={16} />}
          onClick={submit}
          className="!bg-green-600 hover:!bg-green-700 active:!bg-green-800 focus-visible:!ring-green-600"
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CustomOrgListModal;
