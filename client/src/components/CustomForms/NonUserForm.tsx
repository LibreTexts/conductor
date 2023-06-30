import { Form, Header } from "semantic-ui-react";
import { OrgEventParticipant } from "../../types";
import { Control, UseFormGetValues } from "react-hook-form";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";

interface NonUserFormProps {
  control: Control<
    Pick<OrgEventParticipant, "firstName" | "lastName" | "email">
  >;
  isSubForm?: boolean;
}
const NonUserForm: React.FC<NonUserFormProps> = ({
  control,
  isSubForm = false,
}) => {
  const nonUserForm = (
    <>
      <Header as="h4" className="mb-2p" dividing={isSubForm}>
        Participant Information
      </Header>
      <p>
        This is the contact information for the person you are registering for.
      </p>
      <CtlTextInput
        label="First Name"
        placeholder="First Name"
        name="firstName"
        control={control}
        rules={required}
        required={true}
      />
      <CtlTextInput
        label="Last Name"
        placeholder="Last Name"
        name="lastName"
        control={control}
        rules={required}
        required={true}
      />
      <CtlTextInput
        label="Email"
        placeholder="Email"
        name="email"
        control={control}
        rules={required}
        required={true}
      />
    </>
  );

  return isSubForm ? nonUserForm : <Form>{nonUserForm}</Form>;
};

export default NonUserForm;
