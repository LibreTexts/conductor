import { Label } from "semantic-ui-react";

const PageStatusLabel = ({ status }: { status?: "published" | "draft" }) => {
  return (
    <Label
      color={status === "published" ? "green" : "blue"}
      className="!ml-3 !flex !items-center !h-6"
      size="small"
      basic
    >
      {status === "published" ? "Published" : "Draft"}
    </Label>
  );
};

export default PageStatusLabel;
