import { FC, useState } from "react";
import {
  Segment,
  Divider,
  List,
  Image,
  Button,
  Icon,
  Message,
} from "semantic-ui-react";
import MyAppsStatusDetail from "./MyAppsStatusDetail";
import MyAppsRequestModal from "./MyAppsRequestModal";
import useGlobalError from "../error/ErrorHooks";
import { useTypedSelector } from "../../state/hooks";
import axios from "axios";

interface MyAppsProps {}

const MyApps: FC<MyAppsProps> = () => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user); // Will need to be updated to use LibreOne verification status

  const [apps, setApps] = useState<
    { id: string; name: string; icon: string; infoURL: string }[]
  >([
    {
      id: "1",
      name: "App 1",
      icon: "https://react.semantic-ui.com/images/avatar/small/rachel.png",
      infoURL: "https://react.semantic-ui.com/images/avatar/small/rachel.png",
    },
    {
      id: "2",
      name: "App 2",
      icon: "https://react.semantic-ui.com/images/avatar/small/rachel.png",
      infoURL: "https://react.semantic-ui.com/images/avatar/small/rachel.png",
    },
  ]);
  const [requestApps, setRequestApps] = useState<
    { id: string; name: string; icon: string; infoURL: string }[]
  >([]);
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  function addToRequest(app: {
    id: string;
    name: string;
    icon: string;
    infoURL: string;
  }) {
    setRequestApps([...requestApps, app]);
  }

  function removeFromRequest(id: string) {
    setRequestApps(requestApps.filter((item) => item.id !== id));
  }

  return (
    <Segment basic className="pane-segment" loading={loading}>
      <div className="flex-row-div">
        <div style={{ flexBasis: "80%" }}>
          <h2>My Applications</h2>
        </div>
        {requestApps.length > 0 && (
          <div
            className="flex-row-div"
            style={{ flexBasis: "20%", justifyContent: "flex-end" }}
          >
            <Button
              icon
              labelPosition="left"
              primary
              onClick={() => setShowRequestModal(true)}
            >
              <Icon name="cart" />
              <span>Review Request</span>
            </Button>
          </div>
        )}
      </div>
      <Divider />
      {!user.verifiedInstructor && (
        <div>
          <Message info icon>
            <Icon name="exclamation circle" />
            <Message.Content>
              <Message.Header>Instructor Verfication Required</Message.Header>
              <p>
                You have not yet been verified as an instructor. To request
                access to LibreVerse applications that are open to instructors
                only, please submit an{" "}
                <a href="/verification/instructor">
                  Instructor Verification Request
                </a>{" "}
                first.
              </p>
            </Message.Content>
          </Message>
        </div>
      )}
      {user.verifiedInstructor && (
        <>
          <div>
            <h3>Access Granted</h3>
            <p>
              The LibreVerse applications you have access to are listed below.
            </p>
            <List
              divided
              relaxed="very"
              verticalAlign="middle"
              className="mt-1e"
            >
              {apps.map((item) => {
                return (
                  <List.Item key={item.id} className="pr-05e">
                    <Image avatar src={item.icon} />
                    <List.Content>
                      <List.Header>{item.name}</List.Header>
                    </List.Content>
                    <List.Content floated="right" className="mt-05e">
                      <MyAppsStatusDetail status="granted" />
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
          </div>
          <div className="mt-4r">
            <h3>Access Pending</h3>
            <p>
              Applications that you have requested access to are listed below
              while we review your request.
            </p>
            <List
              divided
              relaxed="very"
              verticalAlign="middle"
              className="mt-1e"
            >
              {apps.map((item) => {
                return (
                  <List.Item key={item.id} className="pr-05e">
                    <Image avatar src={item.icon} />
                    <List.Content>
                      <List.Header>{item.name}</List.Header>
                    </List.Content>
                    <List.Content floated="right" className="mt-05e">
                      <MyAppsStatusDetail status="pending" />
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
          </div>
          <div className="mt-4r mb-1r">
            <h3>Access Not Requested</h3>
            <p>
              The LibreVerse applications you have not requested access to are
              listed below. You can request access to these applications by
              clicking the "Add to Request" button and then "Review Request"
              button above when ready.
            </p>
            <List
              divided
              relaxed="very"
              verticalAlign="middle"
              className="mt-1e"
            >
              {apps.map((item) => {
                return (
                  <List.Item key={item.id} className="pr-05e">
                    <Image avatar src={item.icon} />
                    <List.Content>
                      <List.Header>{item.name}</List.Header>
                    </List.Content>
                    <List.Content floated="right" className="mt-05e">
                      {requestApps.map((item) => item.id).includes(item.id) ? (
                        <MyAppsStatusDetail status="inCart" />
                      ) : (
                        <Button color="blue" onClick={() => addToRequest(item)}>
                          <Icon name="plus" />
                          Add to Request
                        </Button>
                      )}
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
          </div>
        </>
      )}
      <MyAppsRequestModal
        show={showRequestModal}
        requestedApps={requestApps}
        onRemoveApp={(id) => removeFromRequest(id)}
        onConfirm={() => setShowRequestModal(false)}
        onCancel={() => setShowRequestModal(false)}
      />
    </Segment>
  );
};

export default MyApps;
