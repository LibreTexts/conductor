import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { KBTreeNode } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import { Tooltip } from "@libretexts/davis-react";
import {
  IconCheck,
  IconPaperclip,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconLock,
} from "@tabler/icons-react";
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
      return <IconCheck size={14} className="ml-2 mt-0.5 text-green-600 shrink-0" aria-label="Published" />;
    }
    return <IconPaperclip size={14} className="ml-2 mb-0.5 text-blue-600 shrink-0" aria-label="Draft" />;
  };

  const InternalLabel = ({ internalOnly }: Pick<KBTreeNode, "internalOnly">) => {
    if (!internalOnly) return null;
    return <IconLock size={14} className="ml-2 mt-0.5 text-amber-600 shrink-0" aria-label="Internal only" />;
  };

  return (
    <nav
      aria-label="Knowledge base navigation"
      aria-busy={loading}
      className={`h-screen-content flex flex-col border-r border-gray-300 ${
        drawerOpen ? "min-w-[15rem] max-w-[20rem]" : "min-w-[4rem] max-w-[4rem]"
      }`}
    >
      {drawerOpen ? (
        <>
          <div className="flex flex-row justify-between border-b mb-1 pb-1 px-4 pt-4 items-center shrink-0">
            <a
              className="text-xl font-semibold text-black rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href="/insight/welcome"
            >
              Insight Articles
            </a>
            {canEdit && (
              <Tooltip content="Create new root level page" placement="top" className="z-[9999]">
                <button
                  type="button"
                  className="mb-1 cursor-pointer text-gray-600 hover:text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-6 min-h-6 flex items-center justify-center"
                  onClick={() => handleCreatePage()}
                  aria-label="Create new root level page"
                >
                  <IconPlus size={18} aria-hidden="true" />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Hide Table of Contents" placement="top" className="z-[9999]">
              <button
                type="button"
                className="mb-1 cursor-pointer text-gray-600 hover:text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-6 min-h-6 flex items-center justify-center"
                onClick={() => handleDrawerChange(false)}
                aria-label="Hide Table of Contents"
              >
                <IconChevronLeft size={22} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
          <div ref={navTreeRef} className="overflow-y-auto flex-1 px-4 pb-4">
          {tree?.map((node, index) => {
            const isActive = isActiveLink(node.slug);
            return (
              <div
                key={node.uuid}
                id={`node-${index}`}
                className={`p-2 rounded-xl ${isActive ? "bg-blue-50" : "hover:bg-slate-100"}`}
                data-active={isActive}
              >
                <div className="flex flex-row justify-between items-center">
                  <div className="flex flex-row items-center overflow-x-clip align-middle">
                    <a
                      className={`text-lg break-words hyphens-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive ? "text-blue-600" : "text-black"
                      }`}
                      href={getLink(node.slug)}
                      onClick={handleLinkClick}
                    >
                      {truncateString(node.title, 50)}
                    </a>
                    {canEdit && <StatusLabel status={node.status} />}
                    {canEdit && <InternalLabel internalOnly={node.internalOnly} />}
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
                          className={`p-2 rounded-lg flex flex-row items-center ${isChildActive ? "bg-blue-50" : "hover:bg-slate-100"}`}
                          data-active={isChildActive}
                        >
                          <a
                            className={`text-md break-words hyphens-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              isChildActive ? "text-blue-600" : "text-gray-600"
                            }`}
                            href={getLink(child.slug)}
                            onClick={handleLinkClick}
                          >
                            {truncateString(child.title, 50)}
                          </a>
                          {canEdit && <StatusLabel status={child.status} />}
                          {canEdit && <InternalLabel internalOnly={child.internalOnly} />}
                        </div>
                      );
                    })}
                  {canEdit && (
                    <button
                      type="button"
                      className="p-2 text-md font-semibold text-blue-500 break-words hyphens-auto cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => handleCreatePage(node.uuid)}
                    >
                      + Add Page
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </>
      ) : (
        <button
          type="button"
          className="flex flex-col items-center cursor-pointer w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          onClick={() => handleDrawerChange(true)}
          aria-label="Show Table of Contents"
        >
          <IconChevronRight size={22} className="ml-2 text-gray-600" aria-hidden="true" />
          <div className="transform -rotate-90 text-xl font-semibold text-black whitespace-nowrap mt-20">
            Table of Contents
          </div>
        </button>
      )}
    </nav>
  );
};

export default NavTree;