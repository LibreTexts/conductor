import { Form, Header } from "semantic-ui-react";
import { OrgEventParticipant } from "../../types";
import { Control, UseFormGetValues } from "react-hook-form";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";

interface ShippingAddressFormProps {
  getValuesFn: UseFormGetValues<Pick<OrgEventParticipant, "shippingAddress">>;
  control: Control<Pick<OrgEventParticipant, "shippingAddress">>;
  isSubForm?: boolean;
}

const ShippingAddressForm: React.FC<ShippingAddressFormProps> = ({
  getValuesFn,
  control,
  isSubForm = false,
}) => {

  const addressForm = (
    <>
      <Header as="h4" className="mb-2p" dividing={isSubForm}>
        Shipping Address
      </Header>
      <p>
        The event organizer has requested that you provide your shipping
        address. This will be used to send you any physical items that you may
        have purchased or are included with your registration. LibreTexts will never
        share your address without permission.
      </p>
      <CtlTextInput
        label="Address Line One"
        placeholder="123 Any St"
        name="shippingAddress.lineOne"
        control={control}
        rules={required}
        required={true}
      />
      <CtlTextInput
        label="Address Line Two"
        placeholder="Suite 123 (optional)"
        name="shippingAddress.lineTwo"
        control={control}
      />
      <CtlTextInput
        label="City"
        placeholder="Anytown"
        name="shippingAddress.city"
        control={control}
        rules={required}
        required={true}
      />
      <CtlTextInput
        label="State"
        placeholder="CA"
        name="shippingAddress.state"
        control={control}
        rules={required}
        required={true}
      />
      <CtlTextInput
        label="Zip Code"
        placeholder="12345"
        name="shippingAddress.zip"
        control={control}
        rules={required}
        required={true}
      />
      <CtlTextInput
        label="Country"
        placeholder="USA"
        name="shippingAddress.country"
        control={control}
        rules={required}
        required={true}
      />
    </>
  );

  return isSubForm ? addressForm : <Form>{addressForm}</Form>;
};

export default ShippingAddressForm;
