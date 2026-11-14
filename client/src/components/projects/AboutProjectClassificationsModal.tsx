import { Button, Card, Modal, Stack, Text } from "@libretexts/davis-react";
import { IconCheck } from "@tabler/icons-react";

interface AboutProjectClassificationsModalProps {
  show: boolean;
  onClose: () => void;
}

const AboutProjectClassificationsModal: React.FC<
  AboutProjectClassificationsModalProps
> = ({ show, onClose }) => {
  return (
    <Modal size="lg" open={show} onClose={(v) => !v && onClose()}>
      <Modal.Header>
        <Modal.Title>About Project Classifications</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md">
          <Text size="sm" className="text-slate-700">
            Project classifications are primarily used to organize and categorize
            projects based on their content, purpose, and target audience. You
            are free to select the classification that you feel best represents
            your project. However, please note that some classifications may
            turn on/off certain Conductor features:
          </Text>
          <Card variant="outline" padding="sm" className="bg-slate-50">
            <Text size="sm" weight="semibold" className="text-slate-900">
              Mini-Repo
            </Text>
            <Text size="xs" color="muted" className="mt-1 block leading-relaxed">
              Intended for projects that center around assets only without an
              associated textbook. Choosing this classification will
              automatically hide textbook-related features in the project&apos;s
              Commons and Conductor pages. Similarly, the project will be listed
              in the Mini-Repo section of the Commons Catalog (assuming its
              visibility is set to &ldquo;Public&rdquo;).
            </Text>
          </Card>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end">
          <Button
            variant="primary"
            icon={<IconCheck size={16} />}
            iconClassName="items-center justify-center"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default AboutProjectClassificationsModal;
