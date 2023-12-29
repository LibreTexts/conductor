import { Image } from "semantic-ui-react";
import { isKBPageEditor } from "../../utils/typeHelpers";
import { KBPage } from "../../types";
import { format, parseISO } from "date-fns";

interface PageLastEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  lastEditedBy?: KBPage["lastEditedBy"];
  updatedAt?: KBPage["updatedAt"];
}

const PageLastEditor: React.FC<PageLastEditorProps> = ({
  lastEditedBy,
  updatedAt,
  ...rest
}) => {
  return (
    <div className="flex flex-row items-center" {...rest}>
      <p className="text-sm text-gray-500">
        Last updated{" "}
        {updatedAt && (
          <span>at {format(parseISO(updatedAt), "MM/dd/yyyy hh:mm a")}</span>
        )}{" "}
        by{" "}
        {isKBPageEditor(lastEditedBy)
          ? `${lastEditedBy.firstName} ${lastEditedBy.lastName}`
          : "Unknown"}
        {isKBPageEditor(lastEditedBy) && (
          <Image src={`${lastEditedBy.avatar}`} avatar className="ml-1 mb-1" />
        )}
      </p>
    </div>
  );
};

export default PageLastEditor;
