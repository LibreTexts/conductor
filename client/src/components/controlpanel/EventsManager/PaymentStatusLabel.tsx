import { Label, LabelProps } from "semantic-ui-react";
import { OrgEventParticipant } from "../../../types";

interface PaymentStatusLabelProps extends LabelProps {
  paymentStatus: OrgEventParticipant["paymentStatus"];
}

const PaymentStatusLabel: React.FC<PaymentStatusLabelProps> = ({
  paymentStatus,
  ...rest
}) => {
  switch (paymentStatus) {
    case "paid":
      return (
        <Label color="green" {...rest}>
          Paid
        </Label>
      );
    case "unpaid":
      return (
        <Label color="red" {...rest}>
          Unpaid
        </Label>
      );
    case "na":
      return (
        <Label color="grey" {...rest}>
          N/A
        </Label>
      );
    default:
      return (
        <Label color="grey" {...rest}>
          Unknown
        </Label>
      );
  }
};

export default PaymentStatusLabel;
