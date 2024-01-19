import { Icon, Label } from "semantic-ui-react";

const TabLabel = ({
  title,
  index,
  itemsCount,
  activeIndex,
  onClick,
  loading,
}: {
  title: "Books" | "Assets" | "Projects";
  index: number;
  itemsCount: number | null;
  activeIndex: number;
  onClick: (index: number) => void;
  loading: boolean;
}) => {
  return (
    <div
      key={title}
      onClick={() => onClick(index)}
      className={`px-2 cursor-pointer pb-2 ${
        activeIndex === index ? "font-bold border-b-2 border-black" : ""
      }`}
    >
      <Icon
        name={
          title === "Books"
            ? "book"
            : title === "Assets"
            ? "file alternate outline"
            : "wrench"
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
