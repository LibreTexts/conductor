import { Button, Dropdown, Modal } from "semantic-ui-react";
import useProjectTeam from "../../../../hooks/projects/useProjectTeam";
import { useState } from "react";

interface NotifyPickerModalProps {
  projectID: string;
  onClose: () => void;
  onSetNotify: (users: string[]) => void;
}

const NotifyPickerModal: React.FC<NotifyPickerModalProps> = ({
  projectID,
  onClose,
  onSetNotify,
}) => {
  const { team, loading } = useProjectTeam({ id: projectID });
  const [teamToNotify, setTeamToNotify] = useState<string[]>([]);

  return (
    <Modal open={true} onClose={onClose}>
      <Modal.Header>Choose People to Notify</Modal.Header>
      <Modal.Content>
        <p>Choose which team members to notify</p>
        <Dropdown
          placeholder="Team members..."
          fluid
          multiple
          search
          selection
          options={team?.map((m) => ({
            key: m.uuid,
            text: `${m.firstName} ${m.lastName}`,
            value: m.uuid,
          }))}
          onChange={(_e, { value }) => setTeamToNotify(value as string[])}
          value={teamToNotify}
          loading={loading}
        />
      </Modal.Content>
      <Modal.Actions>
        <Button
          color="blue"
          loading={loading}
          onClick={() => onSetNotify(teamToNotify)}
        >
          Done
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default NotifyPickerModal;
