import { useState, useEffect } from "react";
import {
  Accordion,
  Button,
  Checkbox,
  Form,
  Icon,
  Input,
  Message,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";
import {
  CentralIdentityApp,
  CentralIdentityVerificationRequest,
} from "../../../types";

interface ApproveVerificationRequestModalProps extends ModalProps {
  show: boolean;
  requestId: string;
  onSave: () => void;
  onCancel: () => void;
}

const ApproveVerificationRequestModal: React.FC<
  ApproveVerificationRequestModalProps
> = ({ show, requestId, onSave, onCancel, ...rest }) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<CentralIdentityVerificationRequest>();
  const [allApps, setAllApps] = useState<CentralIdentityApp[]>([]);
  const [approvedApps, setApprovedApps] = useState<CentralIdentityApp[]>([]);

  // Effects
  useEffect(() => {
    if (show) {
      init();
    }
  }, [show, requestId]);

  useEffect(() => {
    if (allApps.length > 0) {
      initApprovedApps();
    }
  }, [request, allApps]);

  // Methods
  async function init() {
    // We don't use Promise.all here because we want to load the request first
    await loadRequest();
    await loadApps();
    initApprovedApps();
  }

  async function loadRequest() {
    try {
      if (!requestId) return;

      setLoading(true);

      const res = await axios.get(
        `/central-identity/verification-requests/${requestId}`
      );

      if (res.data.err) {
        handleGlobalError(res.data.err);
        return;
      }

      setRequest(res.data.request);
      setApprovedApps(res.data.request.access_request?.applications || []);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadApps() {
    try {
      setLoading(true);
      const res = await axios.get("/central-identity/apps");

      if (res.data.err) {
        handleGlobalError(res.data.err);
        return;
      }

      setAllApps(res.data.applications);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function initApprovedApps() {
    setLoading(true);
    if (
      !request ||
      !request.access_request ||
      !request.access_request.applications ||
      !Array.isArray(request.access_request.applications)
    ) {
      setLoading(false);
      return;
    }

    const requestApps = request?.access_request.applications;
    setApprovedApps([
      ...allApps.filter((app) => {
        return app.is_default_library === true;
      }),
      ...requestApps,
    ]);

    setLoading(false);
  }

  async function submitUpdateRequest() {
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
    if (isChecked(appId)) {
      setApprovedApps(
        approvedApps.filter((app) => {
          return app.id !== appId;
        })
      );
    } else {
      const foundApp = allApps.find((app) => app.id === appId);
      if (!foundApp) return;
      setApprovedApps([...approvedApps, foundApp]);
    }
  }

  return (
    <Modal open={show} onClose={onCancel} size="large" {...rest}>
      <Modal.Header>
        Select Apps To Approve for Verification Request
      </Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div className="pa-2r">
            <Message info icon size="small">
              <Icon name="info circle" />
              <Message.Content>
                Note: Accounts for applications not yet integrated with LibreOne
                will not be automatically appropriated.
              </Message.Content>
            </Message>
            <p>
              The applications {request?.user.first_name}{" "}
              {request?.user.last_name} requested have been pre-selected.
              Select/unselect applications as necessary if you want to provide
              access differenty than the user requested. The user will be
              notified by email of what applications they were approved for.
            </p>
            <Form className="flex-col-div" noValidate>
              {allApps
                .filter(
                  (app) =>
                    app.is_default_library === false &&
                    app.default_access !== "all"
                )
                .map((app) => (
                  <Checkbox
                    key={app.id}
                    label={app.name}
                    checked={isChecked(app.id)}
                    onChange={() => handleCheckApp(app.id)}
                    className="mb-1r"
                  />
                ))}
              <Accordion
                className="mt-2p"
                panels={[
                  {
                    key: "danger",
                    title: {
                      content: (
                        <span>
                          <strong>Change Default Libraries</strong>
                        </span>
                      ),
                    },
                    content: {
                      content: (
                        <div className="flex-col-div">
                          {allApps
                            .filter((app) => app.is_default_library)
                            .map((app) => (
                              <Checkbox
                                key={app.id}
                                label={app.name}
                                checked={isChecked(app.id)}
                                onChange={() => handleCheckApp(app.id)}
                                className="mb-1r"
                              />
                            ))}
                        </div>
                      ),
                    },
                  },
                ]}
              />
            </Form>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onCancel()}>Cancel</Button>
        <Button color="green" onClick={() => submitUpdateRequest()}>
          <Icon name="save" /> Confirm
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ApproveVerificationRequestModal;
