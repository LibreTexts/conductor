import React, { useEffect, useState } from "react";
import { List, Button, Modal, ModalProps, Icon } from "semantic-ui-react";
import TransferList from "../TransferList";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import LoadingSpinner from "../LoadingSpinner";
import axios from "axios";
import { useTypedSelector } from "../../state/hooks";
import { useDispatch } from "react-redux";

interface CustomOrgListModalProps extends ModalProps {
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
  ...rest
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
    <Modal open={show} onClose={onClose} size="large" {...rest}>
      <Modal.Header>Customize Org/Campus List</Modal.Header>
      <Modal.Content>
        {loading && <LoadingSpinner />}
        <TransferList
          availableItems={availbleItems}
          setAvailableItems={setAvailableItems}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          allowManualEntry={true}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Close</Button>
        <Button color="green" onClick={submit}>
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CustomOrgListModal;
