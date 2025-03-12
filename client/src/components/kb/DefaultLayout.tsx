import classNames from "classnames";

const DefaultLayout = ({
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

export default DefaultLayout;
