import { Message, Icon, MessageProps } from "semantic-ui-react";
import Breakpoint from "../util/Breakpoints";
import { User } from "../../types";

interface AuthenticatedStatusMessageProps extends MessageProps {
  user: User;
}

const AuthenticatedStatusMessage: React.FC<AuthenticatedStatusMessageProps> = ({
  user,
  ...rest
}) => {
  if (user.isAuthenticated) {
    return (
      <Message info {...rest}>
        <Message.Content>
          <Breakpoint name="desktop">
            <Icon.Group size="big">
              <Icon name="user circle" />
              <Icon corner name="key" />
            </Icon.Group>
            <span className="ml-1p">
              You're logged into Conductor as{" "}
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              .
            </span>
          </Breakpoint>
          <Breakpoint name="mobileOrTablet">
            <div className="text-center">
              <div>
                <Icon.Group size="big">
                  <Icon name="user circle" />
                  <Icon corner name="key" />
                </Icon.Group>
              </div>
              <p>
                You're logged into Conductor as{" "}
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                .
              </p>
            </div>
          </Breakpoint>
        </Message.Content>
      </Message>
    );
  }

  return (
    <Message warning {...rest}>
      <Message.Content>
        <Breakpoint name="desktop">
          <Icon.Group size="big">
            <Icon name="user circle" />
            <Icon corner name="key" />
          </Icon.Group>
          <span className="ml-1p">
            You are not logged in. You must login to Conductor to register for
            this event.
          </span>
        </Breakpoint>
        <Breakpoint name="mobileOrTablet">
          <div className="text-center">
            <div>
              <Icon.Group size="big">
                <Icon name="user circle" />
                <Icon corner name="key" />
              </Icon.Group>
            </div>
            <p>
              You are not logged in. You must login to Conductor to register for
              this event.
            </p>
          </div>
        </Breakpoint>
      </Message.Content>
    </Message>
  );
};

export default AuthenticatedStatusMessage;
