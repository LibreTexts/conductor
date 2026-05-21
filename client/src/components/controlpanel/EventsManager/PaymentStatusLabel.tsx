import { Badge } from "@libretexts/davis-react";
import { OrgEventParticipant } from "../../../types";

interface PaymentStatusLabelProps {
  paymentStatus: OrgEventParticipant["paymentStatus"];
}

const PaymentStatusLabel: React.FC<PaymentStatusLabelProps> = ({ paymentStatus }) => {
  switch (paymentStatus) {
    case "na":
      return <Badge variant="default" label="N/A" />;
    case "unpaid":
      return <Badge variant="danger" label="Unpaid" />;
    case "paid":
      return <Badge variant="success" label="Paid" />;
    case "waived":
      return <Badge variant="primary" label="Waived" />;
    case "partial_waived":
      return <Badge variant="primary" label="Partially Waived" />;
    case "refunded":
      return <Badge variant="warning" label="Refunded" />;
    default:
      return <Badge variant="default" label="Unknown" />;
  }
};

export default PaymentStatusLabel;
