import { Button, Modal } from "semantic-ui-react";
import { Link } from "react-router-dom";

interface WelcomeToCoAuthorModalProps {
  onClose: () => void;
}

const WelcomeToCoAuthorModal: React.FC<WelcomeToCoAuthorModalProps> = ({
  onClose,
}) => {
  const handleOnAcknowledge = () => {
    window.localStorage.setItem("conductor_show_coauthor_welcome", "false");
    onClose();
  };

  return (
    <Modal open={true} size="large" onClose={onClose}>
      <Modal.Header>Welcome to LibreTexts' AI Co-Author Tools!</Modal.Header>
      <Modal.Content>
        <div className="flex flex-row justify-between items-start">
          <div className="flex flex-col items-start justify-start">
            <p className="text-xl">
              These tools are designed to provide you with powerful AI-driven
              suggestions to help you manage and create your OER content. In
              addition to the instructions on this page, you can find more
              information on how to use these tools in our{" "}
              <a
                href="https://commons.libretexts.org/insight/ai-co-author-tools"
                target="_blank"
              >
                Insight
              </a>{" "}
              knowledge base.
            </p>
            <p className="text-xl mt-6">
              LibreTexts aims to continually empower educators and students with
              the best tools and resources to create and share OER. We hope you
              enjoy using this tool and welcome feedback and suggestions to help
              us improve it. Please feel free to contact us via our{" "}
              <a href="https://commons.libretexts.org/support" target="_blank">
                Support Center
              </a>
              .
            </p>
            <p className="text-xl mt-6">With love,</p>
            <p className="text-xl">The LibreTexts team</p>
          </div>
          <img
            src="https://cdn.libretexts.net/Images/benny-conductor-mascot.png"
            alt="Benny the LibreTexts Mascot"
            className="h-48 w-48"
          />
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleOnAcknowledge} color="green">
          Got it!
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default WelcomeToCoAuthorModal;
