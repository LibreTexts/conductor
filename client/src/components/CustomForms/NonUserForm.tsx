import { OrgEventParticipant } from "../../types";
import { Control } from "react-hook-form";
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
  const fields = (
    <>
      <h4 className={`text-base font-semibold ${isSubForm ? "border-b border-gray-200 pb-1 mb-3" : "mb-2"}`}>
        Participant Information
      </h4>
      <p className="text-sm text-gray-600 mb-4">
        This is the contact information for the person you are registering on behalf of.
      </p>
      <div className="flex flex-col gap-3">
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
      </div>
    </>
  );

  return isSubForm ? fields : <div className="flex flex-col gap-2">{fields}</div>;
};

export default NonUserForm;
