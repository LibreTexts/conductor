import { useState, useEffect } from "react";
import { Button, Form, Modal, Icon, Header } from "semantic-ui-react";
import { CentralIdentityService } from "../../../types";
import axios from "axios";
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
    <Modal open={open} onClose={onClose}>
      <Modal.Header>
        {isEditing ? "Edit Service" : "Service Details"}
      </Modal.Header>
      <Modal.Content>
        {service && (
          <>
            {isEditing ? (
              <Form loading={loading}>
                <Form.Field>
                  <label>Name</label>
                  <input
                    name="name"
                    value={formData.name || ""}
                    onChange={handleChange}
                  />
                </Form.Field>
                <Form.Field>
                  <label>Service ID</label>
                  <input
                    name="service_Id"
                    value={formData.service_Id || ""}
                    onChange={handleChange}
                  />
                </Form.Field>
                <Form.Field>
                  <label>Evaluation Order</label>
                  <input
                    name="evaluation_Order"
                    value={formData.evaluation_Order || ""}
                    onChange={handleChange}
                  />
                </Form.Field>
                <Form.Field>
                  <label>Evaluation Priority</label>
                  <input
                    name="evaluation_Priority"
                    value={formData.evaluation_Priority || ""}
                    onChange={handleChange}
                  />
                </Form.Field>
                <Form.Field>
                  <label>Configuration</label>
                  <input
                    name="body"
                    value={formData.body || ""}
                    onChange={handleChange}
                  />
                </Form.Field>
              </Form>
            ) : (
              <div>
                <Header as="h4">Service Name</Header>
                <p>{service.name}</p>
                <Header as="h4">Service ID</Header>
                <p>{service.service_Id}</p>
                <Header as="h4">Evaluation Order</Header>
                <p>{service.evaluation_Order}</p>
                <Header as="h4">Evaluation Priority</Header>
                <p>{service.evaluation_Priority}</p>
                <Header as="h4">Configuration</Header>
                <p>{service.body}</p>
              </div>
            )}
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Close</Button>
        {isEditing ? (
          <>
            <Button secondary onClick={toggleEditMode}>
              <Icon name="cancel" /> Cancel
            </Button>
            <Button primary onClick={handleSubmit} loading={loading} disabled={!formChanged}>
              <Icon name="save" /> Save Changes
            </Button>
          </>
        ) : (
          <Button color="green" onClick={toggleEditMode}>
            <Icon name="edit" /> Edit Service
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default ViewServiceDetailsModal;