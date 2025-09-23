import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
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
  const navTreeRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

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
    // Restore scroll position with a delay to ensure content is loaded
    const savedScrollPosition = localStorage.getItem('navScrollPosition');
    if (savedScrollPosition && navTreeRef.current) {
      setTimeout(() => {
        if (navTreeRef.current) {
          navTreeRef.current.scrollTop = parseInt(savedScrollPosition, 10);
        }
      }, 100); // Small delay to let content render
    }
  }, [tree]); 

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (navTreeRef.current) {
      const scrollPosition = navTreeRef.current.scrollTop;
      localStorage.setItem('navScrollPosition', scrollPosition.toString());
    }
  }

  useEffect(() => {
    // Load preference from local storage on first render
    const drawerOpen = localStorage.getItem("drawerOpen");
    if (drawerOpen) {
      setDrawerOpen(JSON.parse(drawerOpen));
    }
  }, []);

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

  // Function to check if a link is active
  const isActiveLink = (slug: string) => {
    const linkPath = getLink(slug);
    return location.pathname === linkPath;
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
      ref={navTreeRef}
      aria-busy={loading}
      className={`h-screen-content overflow-y-auto border-r-2 p-4 ${
        drawerOpen ? "min-w-[15rem]" : "min-w-[4rem]"
      } ${drawerOpen ? "max-w-[20rem]" : "max-w-[4rem]"} overflow-y-auto`}
    >
      {drawerOpen ? (
        <>
          <div className="flex flex-row justify-between border-b mb-1 pb-1 items-center max-h-screen">
            <a
              className="text-xl font-semibold text-black"
              href="/insight/welcome"
            >
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
          {tree?.map((node, index) => {
            const isActive = isActiveLink(node.slug);
            return (
              <div
                key={node.uuid}
                id={`node-${index}`} 
                className="p-2 rounded-xl hover:bg-slate-100"
                data-active={isActive}
              >
                <div className="flex flex-row justify-between items-center">
                  <div className="flex flex-row items-center overflow-x-clip align-middle">
                    <a
                      className={`text-lg font-semibold break-words hyphens-auto ${
                        isActive ? "text-blue-600" : "text-black"
                      }`}
                      href={getLink(node.slug)}
                      onClick={handleLinkClick}
                    >
                      {truncateString(node.title, 50)}
                    </a>
                    {canEdit && <StatusLabel status={node.status} />}
                  </div>
                </div>
                <div className="pl-4">
                  {node.children &&
                    node.children.map((child, index) => {
                      const isChildActive = isActiveLink(child.slug);
                      return (
                        <div
                          key={child.uuid}
                          id={`child-${index}`}
                          className="p-2 flex flex-row items-center"
                          data-active={isChildActive}
                        >
                          <a
                            className={`text-md font-semibold break-words hyphens-auto ${
                              isChildActive ? "text-blue-600" : "text-gray-600"
                            }`}
                            href={getLink(child.slug)}
                            onClick={handleLinkClick}
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
        <div
          className="flex flex-col items-center cursor-pointer"
          onClick={() => handleDrawerChange(true)}
        >
          <Icon name="angle right" size="large" className="!ml-2" />
          <div className="transform -rotate-90 text-xl font-semibold text-black whitespace-nowrap mt-20">
            Table of Contents
          </div>
        </div>
      )}
    </div>
  );
};

export default NavTree;