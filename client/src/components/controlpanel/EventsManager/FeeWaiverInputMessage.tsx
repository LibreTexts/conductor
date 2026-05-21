import { Alert } from "@libretexts/davis-react";
import { IconCurrencyDollar } from "@tabler/icons-react";

const FeeWaiverInputMessage: React.FC = () => {
  return (
    <Alert
      variant="info"
      message="Per event settings, participants will be given the option to provide a fee waiver code during registration. Conductor will automatically add this functionality and you do not need to add any additional prompts."
      icon={<IconCurrencyDollar size={18} />}
      showIcon
    />
  );
};

export default FeeWaiverInputMessage;
