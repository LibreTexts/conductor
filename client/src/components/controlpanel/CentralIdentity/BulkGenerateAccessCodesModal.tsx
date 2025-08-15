import { useEffect, useState } from "react";
import { Modal, ModalProps } from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useMutation } from "@tanstack/react-query";
import useCentralIdentityAppLicenses from "../../../hooks/useCentralIdentityAppLicenses";
import Select from "../../NextGenInputs/Select";
import Input from "../../NextGenInputs/Input";
import Button from "../../NextGenComponents/Button";
import { useNotifications } from "../../../context/NotificationContext";

interface BulkGenerateAccessCodesModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
}

const BulkGenerateAccessCodesModal: React.FC<
  BulkGenerateAccessCodesModalProps
> = ({ show, onClose, ...rest }) => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const { data, isLoading } = useCentralIdentityAppLicenses({
    enabled: show,
  });

  const [appLicense, setAppLicense] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    // Ensure state is reset when modal is opened/re-opened
    if (show) {
      setAppLicense(data?.[0]?.uuid || ""); // Select first app license by default
      setQuantity(1);
    }
  }, [show, data]);


  const generateCodesMutation = useMutation({
    mutationFn: async () => {
      if (!appLicense || quantity < 1 || quantity > 1000) {
        throw new Error("Invalid input");
      }

      const res = await api.bulkGenerateCentralIdentityAppLicenseAccessCodes(
        appLicense,
        quantity
      );

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data) {
        throw new Error("No data returned from server");
      }

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `access_codes_${new Date().getTime()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError(error) {
      console.error(error);
      handleGlobalError(error);
    },
    onSuccess() {
      addNotification({
        message: "Access codes generated successfully!",
        type: "success",
      });
      onClose();
    },
  });

  return (
    <Modal
      open={show}
      onClose={onClose}
      {...rest}
      size="small"
      className="min-h-[25rem]"
    >
      <Modal.Header>Bulk Generate Access Codes</Modal.Header>
      <Modal.Content className="min-h-[25rem]">
        <p>
          Generate multiple access codes for a specific app license. The
          generated access codes will be downloaded as a CSV file.{" "}
          <strong>NOTE: </strong>
          Access codes cannot be viewed here after generation, so ensure you
          store the CSV file safely!
        </p>
        <p className="mt-2">
          If you want to grant access to an entire organization regardless of
          quantity, you should do so through the{" "}
          <a href="/controlpanel/libreone/orgs">
            Organizations & Systems console
          </a>
          . Users can redeem these access codes by visiting{" "}
          <a href="https://one.libretexts.org/redeem" target="_blank">
            https://one.libretexts.org/redeem
          </a>
        </p>
        <Select
          name="app-license"
          label="App License"
          options={
            data?.map((license) => ({
              value: license.uuid || "unknown",
              label: license.name,
            })) || []
          }
          disabled={isLoading}
          value={appLicense}
          onChange={(e) => setAppLicense(e.target.value)}
          className="mt-4"
        />
        <Input
          name="quantity"
          label="Quantity (1-1000)"
          type="number"
          min={1}
          max={1000}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="mt-4"
        />
      </Modal.Content>
      <Modal.Actions className="">
        <div className="flex flex-row justify-end gap-2 w-full">
          <Button onClick={onClose} icon="IconCancel" variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={() => generateCodesMutation.mutateAsync()}
            icon="IconDownload"
            loading={generateCodesMutation.isLoading}
          >
            Generate
          </Button>
        </div>
      </Modal.Actions>
    </Modal>
  );
};

export default BulkGenerateAccessCodesModal;
