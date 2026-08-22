import { Alert, Button, Modal } from "@libretexts/davis-react";
import { IconCode } from "@tabler/icons-react";

interface IncompletePrintJobModalProps {
  show: boolean;
  warnings: string[];
  onClose: () => void;
  onFixManually: () => void;
}

/**
 * Shown when the server refuses a plain print job submission because the payload it derived from
 * the Stripe checkout session is incomplete (`code: "INCOMPLETE_PAYLOAD"`).
 *
 * This exists so a non-technical operator is not dead-ended: the same warnings the server used to
 * refuse are listed in plain language, and "Fix Details Manually" hands off to
 * `ManualPrintJobModal`, which re-derives the same payload and re-renders the same warnings above
 * the editor.
 */
const IncompletePrintJobModal: React.FC<IncompletePrintJobModalProps> = ({
  show,
  warnings,
  onClose,
  onFixManually,
}) => {
  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Can&apos;t Submit Automatically</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-gray-700">
          This order is missing information Lulu needs before a print job can be
          created:
        </p>
        {warnings.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 space-y-1">
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        ) : (
          <Alert
            variant="warning"
            className="mt-3"
            message="The server did not report which details are missing. Open the order details editor to review the payload."
          />
        )}
        <p className="mt-4 text-sm text-gray-600">
          Nothing was sent to Lulu. You can correct these details in the order
          details editor and submit from there.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<IconCode size={16} />}
          onClick={onFixManually}
        >
          Fix Details Manually
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default IncompletePrintJobModal;
