import NavTree from "./NavTree";

interface DefaultLayoutWNavTreeProps {
  children: React.ReactNode;
}

const DefaultLayoutWNavTree: React.FC<DefaultLayoutWNavTreeProps> = ({
  children,
}) => {
  return (
    <div className="bg-white h-screen-content !-mb-[2%]">
      <div className="flex flex-row w-full h-screen-content">
        <NavTree />
        <div className="p-8 w-full h-screen-content overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default DefaultLayoutWNavTree;
