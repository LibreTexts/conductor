import "../../../styles/global.css";
import "./ManageUserModal.css";
import { Modal, Button, Icon, ModalProps } from "semantic-ui-react";
import { useState, useEffect } from "react";
import { CentralIdentityUser } from "../../../types";
import axios from "axios";
import useGlobalError from "../../error/ErrorHooks";
import LoadingSpinner from "../../LoadingSpinner";
import { CentralIdentityVerificationRequest } from "../../../types/CentralIdentity";
import DenyVerificationRequestModal from "./DenyVerificationRequestModal";
import DOMPurify from "dompurify";
import ApproveVerificationRequestModal from "./ApproveVerificationRequestModal";

interface ManageVerificationRequestModalProps extends ModalProps {
  show: boolean;
  userId: string;
  requestId: string;
  onSave: () => void;
  onClose: () => void;
}

const ManageVerificationRequestModal: React.FC<
  ManageVerificationRequestModalProps
> = ({ show, userId, requestId, onSave, onClose, ...rest }) => {
  // Hooks and Error Handling
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState<boolean>(false);
  const [user, setUser] = useState<CentralIdentityUser>();
  const [request, setRequest] = useState<CentralIdentityVerificationRequest>();
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showDenyModal, setShowDenyModal] = useState<boolean>(false);
  const [denyType, setDenyType] = useState<"deny" | "request_change">("deny");

  // Effects
  useEffect(() => {
    if (show) {
      loadVerificationRequest();
    }

    // Reset editing states when modal is closed
    if (!show) {
      setUser(undefined);
      setRequest(undefined);
    }
  }, [show, userId, requestId]);

  // Handlers & Methods
  async function loadVerificationRequest() {
    try {
      if (!requestId) return;
      setLoading(true);

      const res = await axios.get(
        `/central-identity/verification-requests/${requestId}`
      );

      if (res.data.err || !res.data.request) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      setRequest(res.data.request);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    onClose();
  }

  function handleDenyOrRequestChanges(action: typeof denyType) {
    setDenyType(action);
    setShowDenyModal(true);
  }

  return (
    <Modal open={show} onClose={onClose} {...rest} size="large">
      <Modal.Header>Manage Verification Request</Modal.Header>
      <Modal.Content scrolling>
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div className="flex-row-div mx-05r">
            <div className="flex-col-div" style={{ flexBasis: "50%" }}>
              <div className="flex-row-div flex-row-verticalcenter mb-2r">
                <p>
                  <strong>Name: </strong>
                  <a
                    href={`/controlpanel/libreone/users?user_id=${request?.user.uuid}`}
                    target="_blank"
                  >
                    {request?.user.first_name} {request?.user.last_name}{" "}
                    <Icon name="external" />
                  </a>
                </p>
              </div>
              <p className="mb-2r">
                <strong>Email: </strong>
                {request?.user.email}
              </p>
              <div className="flex-col-div mb-1r">
                <p>
                  <strong>Bio URL: </strong>
                  <a
                    href={DOMPurify.sanitize(request?.bio_url || "")}
                    target="_blank"
                  >
                    {DOMPurify.sanitize(request?.bio_url || "")}{" "}
                    <Icon name="external" />
                  </a>
                </p>
                <p className="muted-text" style={{ fontSize: "0.9rem" }}>
                  <em>
                    Use caution when opening links. Do not login to any accounts
                    or download any files from untrusted sources.
                  </em>
                </p>
              </div>
            </div>
            <div
              className="flex-col-div mb-1r ml-1r"
              style={{ flexBasis: "50%" }}
            >
              <p>
                <strong>Requested Apps/Libraries:</strong>
              </p>
              <ul>
                {request?.access_request?.applications?.map((app) => (
                  <li key={app.id}>{app.name}</li>
                ))}
                <li key='default'><em>Default Libraries</em></li>
              </ul>
            </div>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions className="flex-row-div justify-between">
        <div>
          <Button
            color="red"
            onClick={() => handleDenyOrRequestChanges("deny")}
            loading={loading}
          >
            <Icon name="ban" />
            Deny
          </Button>
          <Button
            color="yellow"
            onClick={() => handleDenyOrRequestChanges("request_change")}
            loading={loading}
          >
            <Icon name="question" />
            Request Info
          </Button>
        </div>
        <div>
          <Button
            color="green"
            loading={loading}
            onClick={() => setShowApproveModal(true)}
          >
            <Icon name="save" />
            Approve & Select Apps
          </Button>
        </div>
        <div>
          <Button onClick={handleCancel}>Cancel</Button>
        </div>
      </Modal.Actions>
      <ApproveVerificationRequestModal
        show={showApproveModal}
        requestId={requestId}
        onSave={() => onSave()}
        onCancel={() => setShowApproveModal(false)}
      />
      <DenyVerificationRequestModal
        show={showDenyModal}
        action={denyType}
        requestId={requestId}
        onSave={() => onSave()}
        onCancel={() => setShowDenyModal(false)}
      />
    </Modal>
  );
};

export default ManageVerificationRequestModal;
