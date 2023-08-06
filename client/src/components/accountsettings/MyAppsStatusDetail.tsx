import { FC } from "react";
import { Icon, SemanticCOLORS, SemanticICONS } from "semantic-ui-react";
interface MyAppsStatusDetailProps extends React.HTMLAttributes<HTMLDivElement> {
  status: "pending" | "granted" | "inCart";
}

const MyAppsStatusDetail: FC<MyAppsStatusDetailProps> = ({
  status,
  ...rest
}) => {
  let iconName: SemanticICONS;
  let iconColor: SemanticCOLORS;
  let text: string;

  switch (status) {
    case "granted":
      iconName = "check circle";
      iconColor = "green";
      text = "Access Granted";
      break;
    case "inCart":
      iconName = "cart";
      iconColor = "blue";
      text = "Added to Request";
      break;
    case "pending":
    default:
      iconName = "clock outline";
      iconColor = "yellow";
      text = "Access Pending";
      break;
  }

  return (
    <div className="flex-row-div" {...rest}>
      <Icon name={iconName} color={iconColor} className="pt-1p" />
      <span>{text}</span>
    </div>
  );
};

export default MyAppsStatusDetail;
