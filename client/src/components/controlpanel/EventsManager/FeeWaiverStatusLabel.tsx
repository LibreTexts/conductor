import { Label, LabelProps } from "semantic-ui-react";
import { OrgEventFeeWaiver } from "../../../types/OrgEvent";

interface FeeWaiverStatusLabelProps extends LabelProps {
  active: OrgEventFeeWaiver["active"];
}

const FeeWaiverStatusLabel: React.FC<FeeWaiverStatusLabelProps> = ({
  active,
  ...rest
}) => {
  switch (active) {
    case true:
      return (
        <Label color="green" {...rest}>
          Active
        </Label>
      );
    default:
      return (
        <Label color="grey" {...rest}>
          Inactive
        </Label>
      );
  }
};

export default FeeWaiverStatusLabel;
