import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Button,
  Divider,
  Image,
  List,
  Modal,
  Segment,
} from "semantic-ui-react";
import { format, parseISO } from "date-fns";
import useGlobalError from "../error/ErrorHooks";
import { AuthorizedApp } from "../../types";

/**
 * The External Applications pane lists partner applications that the user has authorized to
 * access their account (e.g., via OAuth) and allows access to be revoked.
 */
const ExternalApps = () => {
  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState<boolean>(false);
  const [showRevoke, setShowRevoke] = useState<boolean>(false);
  const [revokeApp, setRevokeApp] = useState<AuthorizedApp>();

  // Data
  const [apps, setApps] = useState<AuthorizedApp[]>([]);

  /**
   * Retrieve data from the server on load.
   */
  useEffect(() => {
    getAuthorizedApplications();
  }, []);

  /**
   * Retrieve the user's authorized applications from the server and save them to state.
   */
  async function getAuthorizedApplications() {
    try {
      setLoading(true);
      const appsRes = await axios.get("/user/authorizedapps");
      if (!appsRes.data.err) {
        if (Array.isArray(appsRes.data.apps)) {
          setApps(appsRes.data.apps);
        }
      } else {
        throw new Error(appsRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Submits a request to the server to revoke an application's access, then
   * refreshes the user's authorized apps list.
   */
  async function submitRevokeAccess() {
    try {
      setLoading(true);
      if (!revokeApp) {
        throw new Error("Error loading app to revoke.");
      }

      const revokeRes = await axios.delete(
        `/user/authorizedapps/${revokeApp.clientID}`
      );
      if (!revokeRes.data.err) {
        getAuthorizedApplications();
        handleCloseRevokeAccess();
      } else {
        throw new Error(revokeRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Opens the Revoke Access modal and saves the application to work on into state.
   *
   * @param {object} app - Information about the app to revoke.
   */
  function handleOpenRevokeAccess(app: any) {
    setRevokeApp(app);
    setShowRevoke(true);
  }

  /**
   * Closes the Revoke Access modal and resets its state.
   */
  function handleCloseRevokeAccess() {
    setShowRevoke(false);
    setRevokeApp(undefined);
  }

  return (
    <Segment basic className="pane-segment" loading={loading}>
      <h2>Authorized External Applications</h2>
      <Divider />
      <p>
        You gave the applications below access to view and/or modify data in
        your Conductor account. Revoke access for applications you no longer
        use.
      </p>
      <List
        divided
        relaxed="very"
        verticalAlign="middle"
        className="mt-2e mb-2e"
      >
        {apps.map((item) => {
          const parsedDate = format(
            parseISO(item.authorizedAt),
            "MMM dd, yyyy"
          ).toString();
          return (
            <List.Item key={item.clientID}>
              <Image avatar src={item.icon} />
              <List.Content>
                <List.Header className="mb-05e">{item.name}</List.Header>
                <span className="muted-text">Authorized on {parsedDate}</span>
                <span className="ml-05e mr-05e">&#8226;</span>
                <a href={item.infoURL} target="_blank" rel="noreferrer">
                  Vendor Information
                </a>
              </List.Content>
              <List.Content floated="right">
                <Button
                  color="red"
                  onClick={() => handleOpenRevokeAccess(item)}
                >
                  Revoke Access
                </Button>
              </List.Content>
            </List.Item>
          );
        })}
        {apps.length === 0 && (
          <p className="muted-text mt-1e mb-1e text-center">
            <em>No apps authorized yet.</em>
          </p>
        )}
      </List>
      <Modal open={showRevoke} onClose={handleCloseRevokeAccess}>
        <Modal.Header>Revoke Application Access</Modal.Header>
        <Modal.Content>
          <p>
            Are you sure you want to revoke account access from{" "}
            <strong>{revokeApp?.name}</strong>? You'll need to re-authorize this
            application if you wish to use it again in the future.
          </p>
        </Modal.Content>
        <Modal.Actions>
          <Button color="red" onClick={submitRevokeAccess} loading={loading}>
            Revoke Access
          </Button>
          <Button onClick={handleCloseRevokeAccess}>Cancel</Button>
        </Modal.Actions>
      </Modal>
    </Segment>
  );
};

export default ExternalApps;
