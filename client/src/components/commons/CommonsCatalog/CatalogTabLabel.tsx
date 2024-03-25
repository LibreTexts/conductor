import { Icon, Label } from "semantic-ui-react";
import { CommonsModule } from "../../../types";

const TabLabel = ({
  title,
  index,
  itemsCount,
  isActive,
  onClick,
  loading,
}: {
  title: "Books" | "Assets" | "Projects" | "Authors";
  index: CommonsModule;
  itemsCount: number | null;
  isActive: boolean;
  onClick: (index: CommonsModule) => void;
  loading: boolean;
}) => {
  return (
    <div
      key={title}
      onClick={() => onClick(index)}
      className={`px-2 cursor-pointer pb-2 ${
        isActive ? "font-bold border-b-2 border-black" : ""
      }`}
    >
      <Icon
        name={
          title === "Books"
            ? "book"
            : title === "Assets"
            ? "file alternate outline"
            : title === "Authors"
            ? "write"
            : 'wrench'
        }
      />
      {title}
      <Label className="!ml-2" size="tiny">
        {loading ? (
          <Icon name="spinner" loading={loading} className="ml-1" />
        ) : (
          <span>{itemsCount ?? 0}</span>
        )}
      </Label>
    </div>
  );
};

export default TabLabel;
