import { useEffect, useState } from "react";
import { Button, Input, Link, Modal, Select, Stack, Text } from "@libretexts/davis-react";
import { IconDownload, IconX } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import useCentralIdentityAppLicenses from "../../../hooks/useCentralIdentityAppLicenses";
import { useNotifications } from "../../../context/NotificationContext";

interface BulkGenerateAccessCodesModalProps {
  show: boolean;
  onClose: () => void;
}

const BulkGenerateAccessCodesModal: React.FC<
  BulkGenerateAccessCodesModalProps
> = ({ show, onClose }) => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const { data, isLoading } = useCentralIdentityAppLicenses({
    enabled: show,
  });

  const [appLicense, setAppLicense] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    if (show) {
      setAppLicense(data?.[0]?.uuid || "");
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
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `access_codes_${new Date().getTime()}.csv`;
      anchor.click();
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
    <Modal open={show} onClose={onClose} size="sm">
      <Modal.Header>
        <Modal.Title>Bulk Generate Access Codes</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md">
          <Text as="p">
            Generate multiple access codes for a specific app license. The
            generated access codes will be downloaded as a CSV file. <strong>Note:</strong>{" "}
            Access codes cannot be viewed here after generation, so ensure you
            store the CSV file safely.
          </Text>
          <Text as="p">
            To grant access to an entire organization regardless of quantity,
            use the{" "}
            <Link href="/controlpanel/libreone/orgs">
              Organizations &amp; Systems console
            </Link>
            . Users can redeem these access codes at{" "}
            <Link href="https://one.libretexts.org/redeem" target="_blank" rel="noreferrer">
              one.libretexts.org/redeem
            </Link>
            .
          </Text>
          <Select
            name="app-license"
            label="App License"
            placeholder="Select an app license"
            options={
              data?.map((license) => ({
                value: license.uuid || "unknown",
                label: license.name,
              })) || []
            }
            disabled={isLoading}
            value={appLicense}
            onChange={(event) => setAppLicense(event.target.value)}
          />
          <Input
            name="quantity"
            label="Quantity (1–1000)"
            type="number"
            min={1}
            max={1000}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full justify-end gap-2">
          <Button
            variant="outline"
            icon={<IconX size={16} aria-hidden="true" />}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<IconDownload size={16} aria-hidden="true" />}
            onClick={() => generateCodesMutation.mutate()}
            loading={generateCodesMutation.isLoading}
            disabled={!appLicense || quantity < 1 || quantity > 1000}
          >
            Generate
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkGenerateAccessCodesModal;
