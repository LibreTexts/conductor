import { Alert } from "@libretexts/davis-react";
import { IconAddressBook } from "@tabler/icons-react";

const CollectShippingMessage: React.FC = () => {
  return (
    <Alert
      variant="info"
      message="Per event settings, participants will be prompted to provide a shipping address during registration. Conductor will automatically add this form and you do not need to add any additional prompts to collect shipping information."
      icon={<IconAddressBook size={18} />}
      showIcon
    />
  );
};

export default CollectShippingMessage;
