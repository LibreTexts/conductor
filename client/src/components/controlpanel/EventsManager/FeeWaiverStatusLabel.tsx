import { Badge } from "@libretexts/davis-react";
import { OrgEventFeeWaiver } from "../../../types/OrgEvent";

interface FeeWaiverStatusLabelProps {
  active: OrgEventFeeWaiver["active"];
}

const FeeWaiverStatusLabel: React.FC<FeeWaiverStatusLabelProps> = ({ active }) => {
  switch (active) {
    case true:
      return <Badge variant="success" label="Active" />;
    default:
      return <Badge variant="default" label="Inactive" />;
  }
};

export default FeeWaiverStatusLabel;
