import { useState } from "react";
import { Form, Divider } from "semantic-ui-react";
import { useFormContext } from "react-hook-form";
import { useTypedSelector } from "../../../state/hooks";
import { SupportTicket } from "../../../types";
import { required } from "../../../utils/formRules";
import Alert from "../../NextGenComponents/Alert";
import CtlNextGenInput from "../../ControlledInputs/CtlNextGenInput";
import Input from "../../NextGenInputs/Input";

interface RequestFormWithAuthProps {
  children: React.ReactNode;
}

const RequestFormWithAuth: React.FC<RequestFormWithAuthProps> = ({
  children,
}) => {
  const user = useTypedSelector((state) => state.user);
  const { control, watch } = useFormContext<SupportTicket>();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [startedConfirming, setStartedConfirming] = useState(false);

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      {user && user.uuid && (
        <Alert
          message="You're logged in so we'll automatically associate this ticket with your account"
          variant="success"
          className="mb-6"
        />
      )}
      {(!user || !user.uuid) && (
        <div className="mb-4">
          <p className="font-bold mb-1 text-lg">Your Contact Info</p>
          <div className="flex flex-col lg:flex-row w-full">
            <div className="w-full mr-8">
              <CtlNextGenInput
                control={control}
                name="guest.firstName"
                label="First Name"
                placeholder="Enter your first name"
                rules={required}
                autoComplete="given-name"
              />
            </div>
            <div className="w-full">
              <CtlNextGenInput
                control={control}
                name="guest.lastName"
                label="Last Name"
                placeholder="Enter your last name"
                rules={required}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="w-full mt-4">
            <CtlNextGenInput
              control={control}
              name="guest.organization"
              label="Organization"
              placeholder="Enter your school or organization"
              rules={required}
              autoComplete="organization"
            />
          </div>
          <div className="w-full mt-4">
            <CtlNextGenInput
              control={control}
              name="guest.email"
              label="Email"
              placeholder="Enter your email"
              rules={required}
              type="email"
              autoComplete="email"
            />
          </div>
          <div className="w-full mt-4">
            <Input
              name="confirmEmail"
              label="Confirm Email"
              placeholder="Confirm your email"
              value={confirmEmail}
              type="email"
              onChange={(e) => {
                setConfirmEmail(e.target.value);
                setStartedConfirming(true);
              }}
            />
            {startedConfirming && confirmEmail !== watch("guest.email") && (
              <p className="text-red-500">Emails do not match</p>
            )}
          </div>
          <Divider className="" />
        </div>
      )}
      {children}
    </Form>
  );
};

export default RequestFormWithAuth;
