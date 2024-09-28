import NavTree from "./NavTree";

interface DefaultLayoutWNavTreeProps {
  children: React.ReactNode;
}

const DefaultLayoutWNavTree: React.FC<DefaultLayoutWNavTreeProps> = ({
  children,
}) => {
  return (
    <div className="bg-white min-h-screen">
      <div className="flex flex-row w-full">
        <NavTree />
        <div className="p-8 w-full">{children}</div>
      </div>
    </div>
  );
};

export default DefaultLayoutWNavTree;
