import React, { useState } from "react";
import { Modal, Button, Icon, Form } from "semantic-ui-react";
import { useForm } from "react-hook-form";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";
import CtlTextArea from "../../ControlledInputs/CtlTextArea";

interface ApproveWithMessageModalProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  approvedApps: any[];
  onSave: () => void;
}

interface FormValues {
  approvalMessage: string;
}

const ApproveWithMessageModal: React.FC<ApproveWithMessageModalProps> = ({
    open,
    onClose,
    requestId,
    approvedApps,
    onSave,
  }) => {
    const { handleGlobalError } = useGlobalError();
    const [loading, setLoading] = useState<boolean>(false);
    
    const {
      control,
      handleSubmit,
      formState: { errors }
    } = useForm<FormValues>({
      defaultValues: {
        approvalMessage: ""
      }
    });
  
    async function onSubmit(data: FormValues) {
      try {
        if (!requestId) return;
        setLoading(true);
        
        const res = await axios.patch(
          `/central-identity/verification-requests/${requestId}`,
          {
            request: {
              effect: "approve",
              reason: data.approvalMessage,
              approved_applications: approvedApps.map((app) => app.id),
            },
          }
        );
        
        if (res.data.err) {
          handleGlobalError(res.data.err);
          return;
        }
        
        onSave();
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoading(false);
        onClose();
      }
    }
  
    return (
      <Modal open={open} onClose={onClose} size="small">
        <Modal.Header>Approve with Message</Modal.Header>
        <Modal.Content>
          <Form onSubmit={handleSubmit(onSubmit)}>
            <CtlTextArea
              name="approvalMessage"
              control={control}
              rules={{ 
                maxLength: {
                  value: 255,
                  message: "Message cannot exceed 255 characters"
                }
              }}
              maxLength={255}
              showRemaining={true}
              fluid
              bordered
              placeholder="Enter a message to the user (max 255 characters)"
            />
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="green"
            loading={loading}
            onClick={handleSubmit(onSubmit)}
          >
            <Icon name="checkmark" />
            Approve
          </Button>
        </Modal.Actions>
      </Modal>
    );
  };
  
  export default ApproveWithMessageModal;