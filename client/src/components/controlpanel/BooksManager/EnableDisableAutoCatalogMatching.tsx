import { useMutation } from "@tanstack/react-query";
import { Modal } from "semantic-ui-react";
import { useNotifications } from "../../../context/NotificationContext";
import useMasterCatalogV2 from "../../../hooks/useMasterCatalogV2";
import Button from "../../NextGenComponents/Button";
import api from "../../../api";
import { useTypedSelector } from "../../../state/hooks";

export type EnableDisableAutoCatalogMatchingProps = {
  open: boolean;
  mode: "enable" | "disable";
  onClose: () => void;
};

const EnableDisableAutoCatalogMatching: React.FC<
  EnableDisableAutoCatalogMatchingProps
> = ({ open, mode, onClose }) => {
  const org = useTypedSelector((state) => state.org);
  const { addNotification } = useNotifications();
  const { invalidate } = useMasterCatalogV2({});

  const updateAutoMatchingMutation = useMutation({
    mutationFn: async (data: { enable: boolean }) => {
      const res = await api.updateAutomaticCatalogMatchingSettings(org.orgID, {
        autoCatalogMatchingEnabled: data.enable,
      });
      return res.data;
    },
    async onSuccess(data, variables, context) {
      await invalidate();
      addNotification({
        type: "success",
        message: `Automatic catalog matching ${
          mode === "enable" ? "enabled" : "disabled"
        } successfully.`,
      });
      onClose();
      window.location.reload(); // Need to do full reload to update redux org state properly
    },
    meta: {
      errorMessage: "Failed to update automatic catalog matching setting.",
    },
  });

  return (
    <Modal open={open} closeOnDimmerClick={false}>
      <Modal.Header>
        {mode === "enable" ? "Enable" : "Disable"} Automatic Catalog Matching?
      </Modal.Header>
      <Modal.Content>
        Are you sure you want to {mode} automatic catalog matching? This will{" "}
        {mode === "enable"
          ? "allow new and current books to be"
          : "prevent new and current books from being"}{" "}
        automatically matched to your Campus Commons catalog based on their URLs
        and your institution's aliases. Any previously selected exclusions from
        automatic matching will be reset.
      </Modal.Content>
      <Modal.Actions className="flex justify-end space-x-2">
        <Button
          variant="secondary"
          onClick={() => onClose()}
          icon="IconX"
          loading={updateAutoMatchingMutation.isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={() =>
            updateAutoMatchingMutation.mutate({ enable: mode === "enable" })
          }
          icon="IconCheck"
          loading={updateAutoMatchingMutation.isLoading}
        >
          {mode === "enable" ? "Enable" : "Disable"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EnableDisableAutoCatalogMatching;
