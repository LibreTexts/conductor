import { Badge } from "@libretexts/davis-react";

type PageStatusLabelProps = {
  status?: "published" | "draft";
  className?: string;
};

const PageStatusLabel: React.FC<PageStatusLabelProps> = ({ status, className }) => {
  return (
    <Badge
      label={status === "published" ? "Published" : "Draft"}
      variant={status === "published" ? "success" : "primary"}
      className={`ml-3 ${className ?? ""}`}
    />
  );
};

export default PageStatusLabel;
