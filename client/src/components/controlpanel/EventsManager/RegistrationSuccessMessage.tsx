import { Message, Icon, MessageProps } from "semantic-ui-react";
import Breakpoint from "../../util/Breakpoints";

const RegistrationSuccessMessage: React.FC<
  { paid?: boolean } & MessageProps
> = ({ paid, ...rest }) => {
  return (
    <Message success {...rest}>
      <Message.Content>
        <Breakpoint name="desktop">
          <Icon.Group size="big">
            <Icon name="check" />
          </Icon.Group>
          <p>
            Success! Your registration has been confirmed. We will be sending a
            confirmation email shortly to the email address associated with your
            Conductor account.
          </p>
          {paid && (
            <p>You should also be receiving a receipt of your payment soon.</p>
          )}
        </Breakpoint>
        <Breakpoint name="mobileOrTablet">
          <div className="text-center">
            <div>
              <Icon.Group size="big">
                <Icon name="check" />
              </Icon.Group>
            </div>
            <p>
              Success! Your registration has been confirmed. We will be sending
              a confirmation email shortly to the email address associated with
              your Conductor account.
            </p>
            {paid && (
              <p>
                You should also be receiving a receipt of your payment soon.
              </p>
            )}
          </div>
        </Breakpoint>
      </Message.Content>
    </Message>
  );
};

export default RegistrationSuccessMessage;
