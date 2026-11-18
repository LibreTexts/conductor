import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTypedSelector } from "../../../state/hooks";
import { SupportTicket } from "../../../types";
import Alert from "../../NextGenComponents/Alert";
import { FormSection, Stack, Input } from "@libretexts/davis-react"

interface RequestFormWithAuthProps {
  children: React.ReactNode;
  showGuestFields?: boolean; // staff logging a request on someone else's behalf
}

const RequestFormWithAuth: React.FC<RequestFormWithAuthProps> = ({
  children,
  showGuestFields,
}) => {
  const user = useTypedSelector((state) => state.user);
  const { watch, register } = useFormContext<SupportTicket>();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [startedConfirming, setStartedConfirming] = useState(false);
  const asGuest = showGuestFields || !user || !user.uuid;

  return (
    <>
      {!asGuest && (
        <Alert
          message="You're logged in so we'll automatically associate this ticket with your account"
          variant="success"
        />
      )}
      {asGuest && (
        <FormSection title={showGuestFields ? "Requester Contact Info" : "Your Contact Info"}>
          <Stack gap="md">
            <Input
              label="First Name"
              placeholder="Enter your first name"
              required={true}
              aria-required="true"
              autoComplete="given-name"
              {...register("guest.firstName", { required: "First name is required" })}
            />
            <Input
              label="Last Name"
              placeholder="Enter your last name"
              required={true}
              aria-required="true"
              autoComplete="family-name"
              {...register("guest.lastName", { required: "Last name is required" })}
            />
            <Input
              label="Organization"
              placeholder="Enter your school or organization"
              required={true}
              aria-required="true"
              {...register("guest.organization", { required: "Organization is required" })}
            />
            <Input
              label="Email"
              placeholder="Enter your email"
              required={true}
              type="email"
              autoComplete="email"
              {...register("guest.email", { required: "Email is required" })}
            />
            <Input
              name="confirmEmail"
              label="Confirm Email"
              placeholder="Confirm your email"
              value={confirmEmail}
              required={true}
              type="email"
              error={startedConfirming && confirmEmail !== watch("guest.email")}
              errorMessage="Emails do not match"
              onChange={(e) => {
                setConfirmEmail(e.target.value);
                setStartedConfirming(true);
              }}
            />
          </Stack>
        </FormSection>
      )}
      {children}
    </>
  );
};

export default RequestFormWithAuth;
