import NavTree from "./NavTree";

const DefaultLayoutWNavTree = ({
  children,
}: {
  children: JSX.Element | JSX.Element[];
}) => {
  return (
    <div className="bg-white h-full">
      <div className="flex flex-row w-full">
        <NavTree />
        <div className="p-8 w-5/6">{children}</div>
      </div>
    </div>
  );
};

export default DefaultLayoutWNavTree;
