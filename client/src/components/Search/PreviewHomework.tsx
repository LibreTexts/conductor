import { Button, Header, Icon, List, Modal, ModalProps, Segment } from "semantic-ui-react";
import { Homework } from "../../types";

interface PreviewHomeworkProps extends ModalProps {
  show: boolean;
  homework: Homework;
  onClose: () => void;
}

const PreviewHomework: React.FC<PreviewHomeworkProps> = ({
  show,
  homework,
  onClose,
}) => {
  return (
    <Modal open={show} onClose={() => onClose()}>
      <Modal.Header as="h2">{homework.title}</Modal.Header>
      <Modal.Content scrolling tabIndex={0}>
        <Header size="small" dividing as="h3">
          Description
        </Header>
        <p>{homework.description}</p>
        {homework.adaptOpen === true && (
          <div>
            <p>
              <em>This course is open for anonymous viewing.</em>
            </p>
            <Button
              color="blue"
              fluid
              as="a"
              href={`https://adapt.libretexts.org/courses/${homework.externalID}/anonymous`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="external" />
              View Course
            </Button>
          </div>
        )}
        <Header size="small" dividing as="h3">
          Assignments
        </Header>
        <Segment basic>
          {homework.adaptAssignments?.length > 0 && (
            <List bulleted>
              {homework.adaptAssignments.map((item, idx) => {
                return (
                  <List.Item
                    key={idx}
                    className="item"
                    content={<span className="ml-05p">{item.title}</span>}
                  />
                );
              })}
            </List>
          )}
          {homework.adaptAssignments?.length === 0 && (
            <p>
              <em>No assignments found.</em>
            </p>
          )}
        </Segment>
      </Modal.Content>
      <Modal.Actions>
        <Button color="blue" onClick={() => onClose()}>
          Done
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default PreviewHomework;
