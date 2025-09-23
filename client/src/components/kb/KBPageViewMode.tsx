import useGlobalError from "../../components/error/ErrorHooks";
import { useEffect, useState } from "react";
import axios from "axios";
import { KBPage } from "../../types";
import KBRenderer from "./KBRenderer";
import PageLastEditor from "./PageLastEditor";
import KBFooter from "./KBFooter";
import PageStatusLabel from "./PageStatusLabel";
import { checkIsUUID } from "../../utils/kbHelpers";
import { useQuery } from "@tanstack/react-query";

type TOCItem = {
  id: string;
  text: string;
  link: string;
  isActive: boolean;
};


const KBPageViewMode = ({
  slug,
  canEdit,
}: {
  slug?: string | null;
  canEdit?: boolean;
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<KBPage | null>(null);
  const [toc, setToc] = useState<TOCItem[] | null>(null);

  const { isFetching: sidebarLoading } = useQuery({
    queryKey: ["nav-tree"],
    enabled: false, // Don't fetch, just check loading state
  });

  useEffect(() => {
    if (slug) {
      loadPage();
    }
  }, []);

  async function loadPage() {
    try {
      const isUUID = checkIsUUID(slug);

      setLoading(true);
      const res = await axios.get(
        `/kb/page/${isUUID ? `${slug}` : `slug/${slug}`}`
      );
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.page) {
        throw new Error("Page not found");
      }
      setPage(res.data.page);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const generateTOC = () => {
    // Find the active node container in the DOM
    const activeNodeContainer = document.querySelector('div[id^="node-"][data-active="true"]');
    if (!activeNodeContainer) return [];

    // Find all child elements within this node's children container
    const childrenLinks = activeNodeContainer.querySelectorAll('div[id^="child-"]');
    
    const toc = Array.from(childrenLinks).map((childDiv, index) => {
      const link = childDiv.querySelector('a[href^="/insight/"]'); 
      if (!link) return null;
      
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();
      const dataActive = link.getAttribute('data-active') === 'true';
      
      return {
        id: `child-${index}`,
        text: text || '',
        link: href || '#',
        isActive: dataActive
      };
    }).filter((item) => item !== null);


    return toc;
  };

  useEffect(() => {
    if (!sidebarLoading) {
      const timer = setTimeout(() => {
        setToc(generateTOC());
      }, 100);
  
      return () => clearTimeout(timer); // Cleanup
    }
  }, [sidebarLoading]);

  return (
    <div aria-busy={loading}>
      <div className="flex flex-row items-center">
        <p className="text-4xl font-semibold">{page?.title}</p>
      </div>
      <p className="max-w-6xl">
        <span className="font-medium">Description</span>:{" "}
        <span className="italic">{page?.description}</span>
      </p>
      <div className="flex flex-row border-b pb-2">
        <PageLastEditor
          lastEditedBy={page?.lastEditedBy}
          updatedAt={page?.updatedAt}
        />
        {canEdit && <PageStatusLabel status={page?.status} className="!mt-0.5"/>}
      </div>

      {toc && toc.length > 0 && (
        <div className="mt-6 mb-9">
          <h3 className="text-xl font-bold underline mb-4">Articles in this section</h3>
          <ul>
            {toc.map((item) => (
              <li key={item.id}>
                <a href={item.link}>{item.text}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 mb-9">
        <KBRenderer content={page?.body} />
      </div>
      <KBFooter />
    </div>
  );
};

export default KBPageViewMode;
