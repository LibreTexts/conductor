import "../../../styles/global.css";
import "./ManageUserModal.css";
import {
  Modal,
  Button,
  Icon,
  ModalProps,
  Form,
  Message,
  Checkbox,
  Divider,
} from "semantic-ui-react";
import { useState, useEffect } from "react";
import axios from "axios";
import useGlobalError from "../../error/ErrorHooks";
import LoadingSpinner from "../../LoadingSpinner";
import {
  CentralIdentityApp,
  CentralIdentityVerificationRequest,
} from "../../../types/CentralIdentity";
import DenyVerificationRequestModal from "./DenyVerificationRequestModal";
import ApproveWithMessageModal from "./ApproveWithMessageModal";
import DOMPurify from "dompurify";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import { marked } from "marked";

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
  const [request, setRequest] = useState<CentralIdentityVerificationRequest>();
  const [showDenyModal, setShowDenyModal] = useState<boolean>(false);
  const [denyType, setDenyType] = useState<"deny" | "request_change">("deny");
  const [approvedApps, setApprovedApps] = useState<CentralIdentityApp[]>([]);
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);

  const { data: allApps, isFetching: allAppsLoading } = useQuery<
    CentralIdentityApp[]
  >({
    queryKey: ["central-identity-apps"],
    queryFn: async () => {
      const res = await api.getCentralIdentityApps();
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return [];
      }
      return res.data.applications || [];
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Effects
  useEffect(() => {
    if (show) {
      loadVerificationRequest();
    }

    // Reset editing states when modal is closed
    if (!show) {
      setRequest(undefined);
    }
  }, [show, userId, requestId]);

  useEffect(() => {
    initApprovedApps();
  }, [request, allApps]);

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

  function initApprovedApps() {
    setLoading(true);
    if (!request) {
      setLoading(false);
      return;
    }

    const requestApps = request?.access_request?.applications || [];

    setApprovedApps([
      ...requestApps,
      ...(allApps
        ? allApps.filter((app) => {
            return app.is_default_library === true;
          })
        : []),
    ]);

    setLoading(false);
  }

  async function handleApprove() {
    try {
      if (!requestId) return;

      setLoading(true);

      const res = await axios.patch(
        `/central-identity/verification-requests/${requestId}`,
        {
          request: {
            effect: "approve",
            approved_applications: approvedApps.map((app) => app.id),
          },
        }
      );
      if (res.data.err) {
        handleGlobalError(res.data.err);
        return;
      }

      onSave();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const isChecked = (appId: number) => {
    if (!approvedApps || approvedApps.length === 0) return false;
    return approvedApps.map((app) => app.id).includes(appId);
  };

  function handleCheckApp(appId: number) {
    const foundApp = allApps?.find((app) => app.id === appId);
    if (!foundApp) return;

    if (isChecked(appId)) {
      setApprovedApps([...approvedApps.filter((app) => app.id !== appId)]);
    } else {
      setApprovedApps([...approvedApps, foundApp]);
    }
  }

  function handleToggleAllLibs() {
    const defaultLibs = allApps?.filter((app) => app.is_default_library) || [];
    const selectedNotDefaultLibs = approvedApps.filter(
      (app) => !app.is_default_library
    ); // Don't override selected libs that aren't default

    if (defaultLibs.length === 0) return; // No default libraries to select

    // if any default libs have already been selected, remove them. Otherwise, add all default libs
    if (defaultLibs.some((app) => isChecked(app.id))) {
      setApprovedApps([...selectedNotDefaultLibs]);
    } else {
      setApprovedApps([...selectedNotDefaultLibs, ...defaultLibs]);
    }
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
          <>
            <div className="flex flex-col">
              <div className="flex flex-row">
                <div className="flex basis-1/2">
                  <p>
                    <strong>Name: </strong>
                    <a
                      href={`/controlpanel/libreone/users/${request?.user.uuid}`}
                      target="_blank"
                    >
                      {request?.user.first_name} {request?.user.last_name}{" "}
                      <Icon name="external" size="small" />
                    </a>
                  </p>
                </div>
                <div className="flex basis-1/2">
                  <p className="mb-2r">
                    <strong>Email: </strong>
                    {request?.user.email}
                  </p>
                </div>
              </div>
              <div className="flex-col-div">
                <div className="flex-col-div mb-1r">
                  <p>
                    <strong>Bio URL: </strong>
                    {request?.bio_url && request?.bio_url.length > 0 ? (
                      <a
                        href={DOMPurify.sanitize(request?.bio_url || "")}
                        target="_blank"
                      >
                        {DOMPurify.sanitize(request?.bio_url || "")}{" "}
                        <Icon name="external" size="small" />
                      </a>
                    ) : (
                      <span className="muted-text">Not provided</span>
                    )}
                  </p>
                </div>
              </div>
              {request?.addtl_info && (
                <div className="flex-col-div">
                  <div className="flex-col-div mb-1r">
                    <p>
                      <strong>Additional Information:</strong>
                    </p>
                    <p
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          marked(request?.addtl_info || "")
                        ),
                      }}
                    ></p>
                  </div>
                </div>
              )}
              <p
                className="muted-text text-center mt-3"
                style={{ fontSize: "0.9rem" }}
              >
                <em>
                  Use caution when opening links. Do not login to any accounts
                  or download any files from untrusted sources.
                </em>
              </p>
            </div>
            <Divider />
            <div className="">
              <Message info icon size="mini">
                <Icon name="info circle" />
                <Message.Content>
                  Note: Accounts for applications not yet integrated with
                  LibreOne will not be automatically appropriated.
                </Message.Content>
              </Message>
              <p>
                The applications {request?.user.first_name}{" "}
                {request?.user.last_name} requested have been pre-selected.
                Select/unselect applications as necessary if you want to provide
                access differenty than the user requested. The user will be
                notified by email of what applications they were approved for.
              </p>
              {allAppsLoading && <LoadingSpinner />}
              {!allAppsLoading && (
                <Form className="flex-col-div mt-4" noValidate>
                  {allApps &&
                    allApps
                      .filter(
                        (app) =>
                          app.is_default_library === false &&
                          app.default_access !== "all"
                      )
                      .map((app) => (
                        <Checkbox
                          key={crypto.randomUUID()}
                          label={app.name}
                          checked={isChecked(app.id)}
                          onChange={() => handleCheckApp(app.id)}
                          className="mb-1r"
                        />
                      ))}
                  <div className="mt-2">
                    <div className="flex flex-row justify-between items-center">
                      <p>
                        <strong>Change Default Libraries</strong>
                      </p>
                      <p
                        className="underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleAllLibs();
                        }}
                      >
                        {approvedApps.filter((app) => app.is_default_library)
                          .length > 0
                          ? "Unselect All"
                          : "Select All"}
                      </p>
                    </div>
                    <div className="flex-col-div mt-4">
                      {allApps &&
                        allApps
                          .filter((app) => app.is_default_library)
                          .map((app) => (
                            <Checkbox
                              key={crypto.randomUUID()}
                              label={app.name}
                              checked={isChecked(app.id)}
                              onChange={() => handleCheckApp(app.id)}
                              className="mb-1r"
                            />
                          ))}
                    </div>
                  </div>
                </Form>
              )}
            </div>
          </>
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
            onClick={() => handleApprove()}
          >
            <Icon name="save" />
            Approve
          </Button>
          <Button
            color="green"
            onClick={() => setShowMessageModal(true)}
            loading={loading}
          >
            <Icon name="comment alternate" /> 
            Approve w/ Message
          </Button>
        </div>
        <div>
          <Button onClick={handleCancel} loading={loading}>
            Cancel
          </Button>
        </div>
      </Modal.Actions>
      <DenyVerificationRequestModal
        show={showDenyModal}
        action={denyType}
        requestId={requestId}
        onSave={() => onSave()}
        onCancel={() => setShowDenyModal(false)}
      />
      <ApproveWithMessageModal
        open={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        requestId={requestId} 
        approvedApps={approvedApps}
        onSave={onSave}
      />
    </Modal>
  );
};

export default ManageVerificationRequestModal;
