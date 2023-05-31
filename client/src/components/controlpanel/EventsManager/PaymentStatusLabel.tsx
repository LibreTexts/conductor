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
    case "na":
      return (
        <Label color="grey" {...rest}>
          N/A
        </Label>
      );
    case "unpaid":
      return (
        <Label color="red" {...rest}>
          Unpaid
        </Label>
      );
    case "paid":
      return (
        <Label color="green" {...rest}>
          Paid
        </Label>
      );
    case "waived":
      return (
        <Label color="blue" {...rest}>
          Waived
        </Label>
      );
    case "partial_waived":
      return (
        <Label color="blue" {...rest}>
          Partially Waived
        </Label>
      );
    case "refunded":
      return (
        <Label color="orange" {...rest}>
          Refunded
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
