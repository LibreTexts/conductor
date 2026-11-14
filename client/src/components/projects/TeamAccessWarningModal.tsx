import React from "react";
import {
  Alert,
  Avatar,
  Button,
  Link as DavisLink,
  Modal,
  Stack,
  Text,
} from "@libretexts/davis-react";
import useClientConfig from "../../hooks/useClientConfig";

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
  onClose,
}) => {
  const { clientConfig } = useClientConfig();
  return (
    <Modal open={open} onClose={(v) => !v && onClose()} size="md">
      <Modal.Header>
        <Modal.Title>Library Access Warning</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md">
          <Alert
            variant="warning"
            message={`The following team members do not have instructor/editor-level access to the ${selectedLibraryName} library.`}
          />
          <Text size="sm" className="text-slate-700">
            They will need to submit an{" "}
            {clientConfig?.instructor_verification_url ? (
              <DavisLink
                href={clientConfig.instructor_verification_url}
                external
              >
                Instructor Verification Request
              </DavisLink>
            ) : (
              <strong>Instructor Verification Request</strong>
            )}{" "}
            to get access. You can proceed with the creation of the book, but
            they will not be able to edit it until they have access.
          </Text>

          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 list-none m-0 p-0">
            {membersWithoutAccess.map((member) => (
              <li key={member.uuid} className="flex items-center gap-3 px-3 py-2">
                <Avatar
                  src={member.avatar}
                  name={`${member.firstName} ${member.lastName}`}
                  size="sm"
                />
                <Text size="sm" weight="medium" className="text-slate-900">
                  {member.firstName} {member.lastName}
                </Text>
              </li>
            ))}
          </ul>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onCreateWithWarning}>
            I understand, proceed with creation
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default TeamAccessWarningModal;
