import { Form, Header, TextArea } from "semantic-ui-react";
import LikertScale from "./LikertScale";
import { CustomFormPrompt, OrgEventParticipant } from "../../types";
import { Control, UseFormGetValues, useForm } from "react-hook-form";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";

interface ShippingAddressFormProps {
  getValuesFn: UseFormGetValues<Pick<OrgEventParticipant, "shippingAddress">>;
  control: Control<Pick<OrgEventParticipant, "shippingAddress">>;
}

const ShippingAddressForm: React.FC<ShippingAddressFormProps> = ({
  getValuesFn,
  control,
}) => {
  return (
    <Form>
      <Header as="h4" className="mb-2p">
        Shipping Address
      </Header>
      <p>
        The event organizer has requested that you provide your shipping
        address. This will be used to send you any physical items that you may
        have purchased or are included with your registration. LibreTexts will
        not use this address for any other purpose.
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
    </Form>
  );
};

export default ShippingAddressForm;
