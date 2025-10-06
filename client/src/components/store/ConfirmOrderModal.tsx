import React from "react";
import { Modal } from "semantic-ui-react";
import Checkbox from "../NextGenInputs/Checkbox";
import Button from "../NextGenComponents/Button";

interface ConfirmOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmOrderModal: React.FC<ConfirmOrderModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [shippingConfirmation, setShippingConfirmation] = React.useState(false);
  const [productionTimeConfirmation, setProductionTimeConfirmation] =
    React.useState(false);
  const [finalConfirmation, setFinalConfirmation] = React.useState(false);

  return (
    <Modal open={isOpen} onClose={onClose} size="small" closeIcon>
      <Modal.Header>Please confirm to proceed to payment</Modal.Header>
      <Modal.Content>
        <Checkbox
          name="production-time-confirmation"
          label="I understand that books are printed on demand and may take 3-5 days to process IN ADDITION to shipping time. 'Expedited' shipping does not expedite production time, only shipping time. LibreTexts is not responsible for delays in production or shipping."
          required
          checked={productionTimeConfirmation}
          onChange={(e) => setProductionTimeConfirmation(e.target.checked)}
          className="mb-8"
          labelClassName="text-lg font-normal"
        />
        <Checkbox
          name="shipping-confirmation"
          label="I have confirmed my email address and shipping details are correct. I understand that if my information is incorrect, LibreTexts may not be able to contact me or ship my order."
          required
          checked={shippingConfirmation}
          onChange={(e) => setShippingConfirmation(e.target.checked)}
          className="mb-8"
          labelClassName="text-lg font-normal"
        />
        <Checkbox
          name="final-confirmation"
          label="I have confirmed my order details and understand that ALL ORDERS ARE FINAL. I understand that I cannot cancel, modify, or return my order after it has been placed."
          required
          checked={finalConfirmation}
          onChange={(e) => setFinalConfirmation(e.target.checked)}
          className="mb-2"
          labelClassName="text-lg font-normal"
        />
      </Modal.Content>
      <Modal.Actions className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} icon="IconX">
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (
              shippingConfirmation &&
              productionTimeConfirmation &&
              finalConfirmation
            ) {
              onConfirm();
            }
          }}
          disabled={
            !shippingConfirmation ||
            !productionTimeConfirmation ||
            !finalConfirmation
          }
          icon="IconCheck"
        >
          Confirm & Proceed to Payment
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmOrderModal;
