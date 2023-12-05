import { useRef, forwardRef, useImperativeHandle } from "react";
import NavTree from "./NavTree";

interface DefaultLayoutWNavTreeProps {
  children: React.ReactNode;
}

const DefaultLayoutWNavTree = forwardRef(
  (props: DefaultLayoutWNavTreeProps, ref) => {
    const navTreeRef = useRef<{ loadTree: () => void }>();

    useImperativeHandle(ref, () => ({
      loadTree: () => {
        if (navTreeRef.current) {
          navTreeRef.current.loadTree();
        }
      },
    }));

    return (
      <div className="bg-white min-h-screen">
        <div className="flex flex-row w-full">
          <NavTree ref={navTreeRef} />
          <div className="p-8 w-5/6">{props.children}</div>
        </div>
      </div>
    );
  }
);

export default DefaultLayoutWNavTree;
