import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { KBTreeNode } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import { Icon, Label, LabelProps, Popup } from "semantic-ui-react";
import { truncateString } from "../util/HelperFunctions";
import { canEditKB } from "../../utils/kbHelpers";

const NavTree = forwardRef((props, ref) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState<KBTreeNode[]>([]);
  const [canEdit, setCanEdit] = useState(false);

  // Allows parent component to call this function
  useImperativeHandle(ref, () => ({
    loadTree,
  }));

  useEffect(() => {
    loadTree();
  }, []);

  useEffect(() => {
    setCanEdit(canEditKB(user));
  }, [user]);

  async function loadTree() {
    try {
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

  const getLink = (slug: string) => {
    if (!slug) return `/insight/welcome`;
    return `/insight/${slug}`;
  };

  function handleCreatePage(parent?: string) {
    if (!parent) {
      window.location.assign(`/insight/new`);
    } else {
      window.location.assign(`/insight/new?parent=${parent}`);
    }
  }

  const StatusLabel = ({
    status,
    ...rest
  }: Pick<KBTreeNode, "status"> & LabelProps) => {
    return (
      <Label
        color={status === "draft" ? "blue" : "green"}
        size="mini"
        circular
        basic
        {...rest}
      >
        {status === "draft" ? "D" : <Icon name="check" className="!m-0" />}
      </Label>
    );
  };

  return (
    <div
      aria-busy={loading}
      className="h-auto min-h-screen w-1/6 border-r-2 p-4"
    >
      <div className="flex flex-row justify-between border-b mb-1 pb-1 items-center">
        <a className="text-xl font-semibold text-black" href="/insight/welcome">
          Insight Articles
        </a>
        {canEdit && (
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
              <div className="flex flex-row items-center overflow-x-clip">
                <a
                  className="text-lg font-semibold text-black"
                  href={getLink(node.slug)}
                >
                  {truncateString(node.title, 50)}
                </a>
                {canEdit && (
                  <StatusLabel status={node.status} className="!ml-2 !mr-3" />
                )}
              </div>
              {canEdit && (
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
                    <div
                      key={child.uuid}
                      className="p-2 flex flex-row items-center"
                    >
                      <a
                        className="text-md font-semibold text-gray-600"
                        href={getLink(child.slug)}
                      >
                        {truncateString(child.title, 50)}
                      </a>
                      {canEdit && (
                        <StatusLabel status={child.status} className="!ml-2 !mr-2" />
                      )}
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
