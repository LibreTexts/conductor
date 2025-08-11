import { Button, Icon, Modal, ModalProps } from "semantic-ui-react";
import "./Projects.css";

interface AboutProjectClassificationsModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
}

const AboutProjectClassificationsModal: React.FC<
  AboutProjectClassificationsModalProps
> = ({ show, onClose, ...rest }) => {
  return (
    <Modal size="fullscreen" open={show} {...rest}>
      <Modal.Header>About Project Classifications</Modal.Header>
      <Modal.Content>
        <p>
          Project classifications are primarily used to organize and categorize
          projects based on their content, purpose, and target audience. You are
          free to select the classification that you feel best represents your
          project. However, please note that some classifications may turn
          on/off certain Conductor features. These classifications include:
        </p>
        <ul className="px-6 mt-4">
          <li className="list-disc">
            <span className="font-semibold">Mini-Repo:</span> Intended for
            projects that center around assets only without an associated
            textbook. Choosing this classification will automatically hide
            textbook-related features in the project's Commons and Conductor
            pages. Similarly, the project will be listed in the Mini-Repo
            section of the Commons Catalog (assuming it's visibility is set to
            "Public").
          </li>
        </ul>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} labelPosition="left" icon color="green">
          <Icon name="check" />
          Done
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AboutProjectClassificationsModal;
