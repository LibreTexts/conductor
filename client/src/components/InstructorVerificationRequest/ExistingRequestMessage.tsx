import { FC } from "react";
import { Message, Icon, Button, MessageProps } from "semantic-ui-react";
import { Link } from "react-router-dom";
import { STATUS_OPTIONS_DATA } from "../../utils/instructorVerificationRequestHelpers";
import { InstructorVerifReqStatus } from "../../types";

// Have to use 'reqStatus' instead of 'status' because 'status' is a reserved word
interface ExistingRequestMessageProps extends MessageProps {
  reqStatus: InstructorVerifReqStatus;
}

const ExistingRequestMessage: FC<ExistingRequestMessageProps> = ({
  reqStatus,
  ...rest
}) => {
  const foundStatus = STATUS_OPTIONS_DATA.find((s) => s.key === reqStatus);

  return (
    <Message color={foundStatus?.color ?? 'blue'} icon {...rest}>
      <Icon name={foundStatus?.icon ?? 'clock outline'} />
      <Message.Content>
        <Message.Header>{foundStatus?.heading}</Message.Header>
        <p>{foundStatus?.message} </p>
        {
            foundStatus?.canResubmit && (
                <Button>Resubmit Request</Button>
            )
        }
      </Message.Content>
    </Message>
  );
};

export default ExistingRequestMessage;
