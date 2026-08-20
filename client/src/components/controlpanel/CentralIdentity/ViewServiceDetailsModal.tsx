import { useEffect, useState } from "react";
import {
  Button,
  Heading,
  Input,
  Modal,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { IconDeviceFloppy, IconEdit, IconX } from "@tabler/icons-react";
import { CentralIdentityService } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";

interface ViewServiceDetailsModalProps {
  open: boolean;
  onClose: () => void;
  service: CentralIdentityService | null;
  onServiceUpdated?: () => void;
}

const ViewServiceDetailsModal = ({
  open,
  onClose,
  service,
  onServiceUpdated,
}: ViewServiceDetailsModalProps) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<CentralIdentityService>>({});
  const [originalData, setOriginalData] = useState<Partial<CentralIdentityService>>({});
  const [formChanged, setFormChanged] = useState<boolean>(false);

  useEffect(() => {
    if (service) {
      setFormData({ ...service });
    }
    setIsEditing(false);
    setFormChanged(false);
  }, [service, open]);

  useEffect(() => {
    if (originalData && Object.keys(originalData).length > 0) {
      const hasChanged = JSON.stringify(formData) !== JSON.stringify(originalData);
      setFormChanged(hasChanged);
    }
  }, [formData, originalData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!service) return;
    
    try {
      setLoading(true);
      await api.updateCentralIdentityService({ body: JSON.stringify(formData) }, service.id);
      Object.assign(service, formData);
      
      if (onServiceUpdated) {
        onServiceUpdated();
      }
      setIsEditing(false);
      setFormChanged(false);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setFormData({ ...service });
      setOriginalData({ ...service });
      setFormChanged(false);
    }
  };

  return (
    <Modal open={open} onClose={(isOpen) => !isOpen && onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>
          {isEditing ? "Edit Service" : "Service Details"}
        </Modal.Title>
        <Modal.Close aria-label="Close service details" />
      </Modal.Header>
      <Modal.Body>
        {service && (
          <Stack direction="vertical" gap="md">
            {isEditing ? (
              <Stack direction="vertical" gap="md">
                <Input name="name" label="Name" value={formData.name || ""} onChange={handleChange} disabled={loading} />
                <Input name="service_Id" label="Service ID" value={formData.service_Id || ""} onChange={handleChange} disabled={loading} />
                <Input name="evaluation_Order" label="Evaluation Order" value={formData.evaluation_Order || ""} onChange={handleChange} disabled={loading} />
                <Input name="evaluation_Priority" label="Evaluation Priority" value={formData.evaluation_Priority || ""} onChange={handleChange} disabled={loading} />
                <Input name="body" label="Configuration" value={formData.body || ""} onChange={handleChange} disabled={loading} />
              </Stack>
            ) : (
              <Stack direction="vertical" gap="md">
                {[
                  ["Service Name", service.name],
                  ["Service ID", service.service_Id],
                  ["Evaluation Order", service.evaluation_Order],
                  ["Evaluation Priority", service.evaluation_Priority],
                  ["Configuration", service.body],
                ].map(([label, value]) => (
                  <div key={label}>
                    <Heading level={4}>{label}</Heading>
                    <Text as="p" className="break-all">{value || "N/A"}</Text>
                  </div>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>Close</Button>
        {isEditing ? (
          <>
            <Button variant="outline" icon={<IconX size={16} />} onClick={toggleEditMode}>
              Cancel
            </Button>
            <Button variant="primary" icon={<IconDeviceFloppy size={16} />} onClick={handleSubmit} loading={loading} disabled={!formChanged}>
              Save Changes
            </Button>
          </>
        ) : (
          <Button variant="primary" icon={<IconEdit size={16} />} onClick={toggleEditMode}>
            Edit Service
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ViewServiceDetailsModal;
