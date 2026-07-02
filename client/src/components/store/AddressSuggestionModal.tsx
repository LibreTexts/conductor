import { Modal, Button, Card, Text, Alert, Stack } from "@libretexts/davis-react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { StoreAddressFields } from "../../types";

interface AddressSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress: StoreAddressFields;
  suggestedAddress: StoreAddressFields;
  onResolve: (accepted: boolean) => void;
}

const AddressDisplay: React.FC<{ address: StoreAddressFields }> = ({ address }) => (
  <Stack gap="xs">
    <Text as="p">{address.address_line_1}</Text>
    {address.address_line_2 && <Text as="p">{address.address_line_2}</Text>}
    <Text as="p">
      {address.city}, {address.state} {address.postal_code}
    </Text>
    <Text as="p" color="muted">
      {address.country}
    </Text>
  </Stack>
);

const AddressSuggestionModal: React.FC<AddressSuggestionModalProps> = ({
  isOpen,
  onClose,
  currentAddress,
  suggestedAddress,
  onResolve,
}) => {
  const suggestionExceedsLimit = suggestedAddress.address_line_1.length > 30;

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>We found a suggested correction for your address</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Text as="p" className="mb-4">
          Double-check the suggested address below, then choose whether to use it or keep what you
          entered.
        </Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card variant="outline" padding="md">
            <Card.Header>
              <Text weight="semibold">You entered</Text>
            </Card.Header>
            <Card.Body>
              <AddressDisplay address={currentAddress} />
            </Card.Body>
          </Card>
          <Card variant="outline" padding="md">
            <Card.Header>
              <Text weight="semibold">Suggested address</Text>
            </Card.Header>
            <Card.Body>
              <AddressDisplay address={suggestedAddress} />
            </Card.Body>
          </Card>
        </div>
        {suggestionExceedsLimit && (
          <Alert
            className="mt-4"
            variant="warning"
            title="Address line 1 is too long"
            message="The suggested Address line 1 is longer than the 30-character limit our print partner allows. If you use this suggestion, you'll need to shorten it before shipping options can be fetched."
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" icon={<IconX size={16} />} onClick={() => onResolve(false)}>
            Keep my entry
          </Button>
          <Button variant="primary" icon={<IconCheck size={16} />} onClick={() => onResolve(true)}>
            Use suggested address
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default AddressSuggestionModal;
