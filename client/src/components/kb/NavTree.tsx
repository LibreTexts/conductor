import { useState, useEffect } from "react";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { KBTreeNode } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import { Icon, Popup } from "semantic-ui-react";
import { truncateString } from "../util/HelperFunctions";
import { canEditKB } from "../../utils/kbHelpers";
import { useQuery } from "@tanstack/react-query";

const NavTree = () => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const [canEdit, setCanEdit] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const {
    data: tree,
    isFetching: loading,
    refetch,
  } = useQuery<KBTreeNode[]>({
    queryKey: ["nav-tree"],
    queryFn: loadTree,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setCanEdit(canEditKB(user));
  }, [user]);

  useEffect(() => {
    // Load preference from local storage on first render
    const drawerOpen = localStorage.getItem("drawerOpen");
    if (drawerOpen) {
      setDrawerOpen(JSON.parse(drawerOpen));
    }
  }, [])

  function handleDrawerChange(newState: boolean) {
    setDrawerOpen(newState);
    localStorage.setItem("drawerOpen", newState.toString());
  }

  async function loadTree() {
    try {
      const res = await axios.get(`/kb/tree`);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.tree || !Array.isArray(res.data.tree)) {
        throw new Error("Tree not found");
      }
      return res.data.tree || [];
    } catch (err) {
      handleGlobalError(err);
      return [];
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

  const StatusLabel = ({ status }: Pick<KBTreeNode, "status">) => {
    if (status === "published") {
      return (
        <Icon name="check" className="!ml-2 !mt-1" color="green" size="small" />
      );
    }
    return <Icon name="paperclip" className="!ml-2 !mb-1" color="blue" />;
  };

  return (
    <div
      aria-busy={loading}
      className={`h-auto min-h-screen border-r-2 p-4 ${drawerOpen ? "min-w-[15rem]" : "min-w-[4rem]"} ${drawerOpen ? "max-w-[20rem]" : "max-w-[4rem]"} overflow-y-auto`}
    >
      {
        drawerOpen ? (
          <>
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
              <Popup
                trigger={
                  <Icon
                    name="angle left"
                    className="!mb-1 !cursor-pointer"
                    size="large"
                    onClick={() => handleDrawerChange(false)}
                  />
                }
                position="top center"
              >
                <Popup.Content>
                  <p className="text-sm">Hide Table of Contents</p>
                </Popup.Content>
              </Popup>
            </div>
            {tree?.map((node) => {
              return (
                <div key={node.uuid} className="p-2 rounded-xl hover:bg-slate-100">
                  <div className="flex flex-row justify-between items-center">
                    <div className="flex flex-row items-center overflow-x-clip align-middle">
                      <a
                        className="text-lg font-semibold text-black break-words hyphens-auto"
                        href={getLink(node.slug)}
                      >
                        {truncateString(node.title, 50)}
                      </a>
                      {canEdit && <StatusLabel status={node.status} />}
                    </div>
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
                              className="text-md font-semibold text-gray-600 break-words hyphens-auto"
                              href={getLink(child.slug)}
                            >
                              {truncateString(child.title, 50)}
                            </a>
                            {canEdit && <StatusLabel status={child.status} />}
                          </div>
                        );
                      })}
                    {canEdit && (
                      <a
                        className="p-2 text-md font-semibold text-blue-500  break-words hyphens-auto !cursor-pointer"
                        onClick={() => handleCreatePage(node.uuid)}
                      >
                        + Add Page
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center cursor-pointer" onClick={() => handleDrawerChange(true)}>
              <Icon
                name="angle right"
                size="large"
                className="!ml-2"
              />
              <div className="transform -rotate-90 text-xl font-semibold text-black whitespace-nowrap mt-20">
                Table of Contents
              </div>
            </div>
        )}
    </div>
  );
};

export default NavTree;
