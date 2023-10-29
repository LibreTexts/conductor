import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { KBTreeNode } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import { Icon, Popup } from "semantic-ui-react";

const NavTree = forwardRef((props, ref) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState<KBTreeNode[]>([]);

  // Allows parent component to call this function
  useImperativeHandle(ref, () => ({
    loadTree,
  }));

  useEffect(() => {
    loadTree();
  }, []);

  async function loadTree() {
    try {
      console.log("loading tree");
      setLoading(true);
      const res = await axios.get(`/kb/tree`);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.tree || !Array.isArray(res.data.tree)) {
        throw new Error("Tree not found");
      }
      setTree(res.data.tree);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const getLink = (uuid: string) => {
    return `/kb/page/${uuid}`;
  };

  function handleCreatePage(parent?: string) {
    if (!parent) {
      window.location.assign(`/kb/page/new`);
    } else {
      window.location.assign(`/kb/page/new?parent=${parent}`);
    }
  }

  return (
    <div aria-busy={loading} className="h-screen w-1/6 border-r-2 p-4">
      <div className="flex flex-row justify-between border-b mb-1 pb-1 items-center">
        <p className="text-xl font-semibold">Knowledge Base</p>
        {user.isSuperAdmin && (
          <Popup
            trigger={
              <Icon
                name="plus"
                className="!mb-1 !cursor-pointer"
                onClick={() => handleCreatePage()}
              />
            }
            position="top center"
          >
            <Popup.Content>
              <p className="text-sm">Create new root level page</p>
            </Popup.Content>
          </Popup>
        )}
      </div>
      {tree.map((node) => {
        return (
          <div key={node.uuid} className="p-2 rounded-xl hover:bg-slate-100">
            <div className="flex flex-row justify-between items-center">
              <a
                className="text-lg font-semibold text-black"
                href={getLink(node.uuid)}
              >
                - {node.title}
              </a>
              {user.isSuperAdmin && (
                <Popup
                  trigger={
                    <Icon
                      name="plus"
                      className="!mb-1 !cursor-pointer"
                      onClick={() => handleCreatePage(node.uuid)}
                    />
                  }
                  position="top center"
                >
                  <Popup.Content>
                    <p className="text-sm">Create new sub page</p>
                  </Popup.Content>
                </Popup>
              )}
            </div>
            <div className="pl-4">
              {node.children &&
                node.children.map((child) => {
                  return (
                    <div key={child.uuid} className="p-2">
                      <a
                        className="text-md font-semibold text-gray-600"
                        href={getLink(child.uuid)}
                      >
                        - {child.title}
                      </a>
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default NavTree;
