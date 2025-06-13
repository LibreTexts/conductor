import classNames from "classnames";

/**
 * Alternative layout for non-typical pages, e.g. Support Center, Bookstore, etc.
 */
const AlternateLayout = ({
  children,
  altBackground,
  h = "screen",
  className,
}: {
  children: JSX.Element[] | JSX.Element;
  altBackground?: boolean;
  h?: "screen" | "screen-content";
  className?: string;
}) => {
  return (
    <div
      className={classNames(
        "flex flex-col -mb-[2%]",
        h === "screen" ? "min-h-screen" : "h-screen-content",
        altBackground ? "" : "bg-white",
        className
      )}
    >
      {children}
    </div>
  );
};

export default AlternateLayout;
