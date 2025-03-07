import React from 'react';
import { Modal, Button, Table, Image } from 'semantic-ui-react';
import { getCentralAuthInstructorURL } from '../../utils/centralIdentityHelpers';

interface TeamMemberWithoutAccess {
  uuid: string;
  firstName: string; 
  lastName: string;
  avatar: string;
}

interface TeamAccessWarningModalProps {
  open: boolean;
  selectedLibraryName: string;
  membersWithoutAccess: TeamMemberWithoutAccess[];
  onCreateWithWarning: () => void;
  onClose: () => void;
}

const TeamAccessWarningModal: React.FC<TeamAccessWarningModalProps> = ({
  open,
  selectedLibraryName,
  membersWithoutAccess,
  onCreateWithWarning,
  onClose
}) => {
  return (
    <Modal open={open} size="small">
      <Modal.Header>Library Access Warning</Modal.Header>
      <Modal.Content>
        <p>
          The following team members do not have instructor/editor-level access to the <b>{selectedLibraryName}</b> library. 
          They will need to submit an <a href={getCentralAuthInstructorURL()} target="_blank">Instructor Verification Request</a> to get access.
        </p>
        
        <Table basic="very">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {membersWithoutAccess.map((member) => (
              <Table.Row key={member.uuid}>
                <Table.Cell>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Image src={member.avatar} avatar style={{ marginRight: '10px' }} />
                    {member.firstName} {member.lastName}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Modal.Content>
      <Modal.Actions>
        <Button 
          color="blue" 
          onClick={onCreateWithWarning}
        >
          I understand
        </Button>
        <Button 
          onClick={onClose}
        >
          Cancel
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default TeamAccessWarningModal;