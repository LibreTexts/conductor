import { Message, Icon } from "semantic-ui-react";
import Breakpoint from "../../util/Breakpoints";

const FeeWaiverInputMessage: React.FC = ({ ...rest }) => {
  return (
    <Message info {...rest}>
      <Message.Content>
        <Breakpoint name="desktop">
          <div className="flex-row-div flex-row-verticalcenter">
            <Icon name="dollar" />
            <p className="ml-1p">
              Per event settings, participants will be given the option to 
              provide a fee waiver code during registration. Conductor will 
              automatically add this functionality and you do not need to 
              add any additional prompts.
            </p>
          </div>
        </Breakpoint>
      </Message.Content>
    </Message>
  );
};

export default FeeWaiverInputMessage;
