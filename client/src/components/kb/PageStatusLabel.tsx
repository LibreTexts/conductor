import { Label, LabelProps } from "semantic-ui-react";

type PageStatusLabelProps = LabelProps & {
  status?: "published" | "draft";
};

const PageStatusLabel: React.FC<PageStatusLabelProps> = ({
  status,
  className,
  ...rest
}) => {
  return (
    <Label
      color={status === "published" ? "green" : "blue"}
      className={`!ml-3 !flex !items-center !h-6 ${className}`}
      size="small"
      {...rest}
    >
      {status === "published" ? "Published" : "Draft"}
    </Label>
  );
};

export default PageStatusLabel;
