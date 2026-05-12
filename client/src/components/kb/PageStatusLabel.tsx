import { Badge } from "@libretexts/davis-react";

type PageStatusLabelProps = {
  status?: "published" | "draft";
  className?: string;
};

const PageStatusLabel: React.FC<PageStatusLabelProps> = ({ status, className }) => {
  return (
    <Badge
      variant={status === "published" ? "success" : "primary"}
      className={`ml-3 ${className ?? ""}`}
    >
      {status === "published" ? "Published" : "Draft"}
    </Badge>
  );
};

export default PageStatusLabel;
