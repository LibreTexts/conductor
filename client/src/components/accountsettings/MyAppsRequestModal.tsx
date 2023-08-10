import { FC } from "react";
import { Button, Modal, ModalProps } from "semantic-ui-react";
import "./MyAppsRequestModal.css";

interface MyAppsRequestModalProps extends ModalProps {
  show: boolean;
  requestedApps: { id: string; name: string; icon: string; infoURL: string }[];
  onRemoveApp: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const MyAppsRequestModal: FC<MyAppsRequestModalProps> = ({
  show,
  requestedApps,
  onRemoveApp,
  onConfirm,
  onCancel,
  ...rest
}) => {
  return (
    <Modal size="large" open={show} onClose={onCancel} {...rest}>
      <Modal.Header>Review Access Request</Modal.Header>
      <Modal.Content>
        {requestedApps.length === 0 ? (
          <em>
            Your access request currenlty has no applications selected. Please
            close this dialog and select one or more applications from the list.
          </em>
        ) : (
          <>
            <p>
              The following applications have been added to your access request:
            </p>
            <div className="my-1e">
              {requestedApps.map((app, appIdx) => {
                return (
                  <div key={app.id} className="cart-item">
                    <div className="cart-item-left">
                      <span className="cart-item-title">{app.name}</span>
                    </div>
                    <div className="cart-item-right">
                      <Button
                        onClick={() => onRemoveApp(app.id)}
                        icon="times"
                        size="mini"
                        color="red"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCancel}>Cancel</Button>
        {requestedApps.length > 0 && (
          <Button color="green">Submit Request</Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default MyAppsRequestModal;
