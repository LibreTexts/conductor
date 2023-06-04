import { Message, Icon, MessageProps } from "semantic-ui-react";
import Breakpoint from "../../util/Breakpoints";

const CollectShippingMessage: React.FC = ({ ...rest }) => {
  return (
    <Message info {...rest}>
      <Message.Content>
        <Breakpoint name="desktop">
          <div className="flex-row-div flex-row-verticalcenter">
            <Icon name="address book" />
            <p className="ml-1p">
              Per event settings, participants will be prompted to provide a
              shipping address during registration. Conductor will automatically
              add this form and you do not need to add any additional prompts to
              collect shipping information.
            </p>
          </div>
        </Breakpoint>
      </Message.Content>
    </Message>
  );
};

export default CollectShippingMessage;
