import classNames from "classnames";
import { Icon, SemanticICONS } from "semantic-ui-react";

interface CatalogDetailMetaProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: SemanticICONS;
  text: string;
  textClassName?: string;
}

const CatalogDetailMeta: React.FC<CatalogDetailMetaProps> = ({
  icon,
  text,
  textClassName,
  ...props
}) => {
  const { className, ...rest } = props;
  return (
    <div className={classNames("flex", className)} {...rest}>
      <div>
        <Icon name={icon} className="text-blue-500" />
      </div>
      <p className={classNames(textClassName, "text-slate-600 ml-1.5")}>{text}</p>
    </div>
  );
};

export default CatalogDetailMeta;
