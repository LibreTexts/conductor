import { useParams } from "react-router-dom";
import useGlobalError from "../../components/error/ErrorHooks";
import { useEffect, useState } from "react";
import axios from "axios";
import { KBPage } from "../../types";
import KBRenderer from "./KBRenderer";
import PageLastEditor from "./PageLastEditor";
import KBFooter from "./KBFooter";
import PageStatusLabel from "./PageStatusLabel";
import { checkIsUUID } from "../../utils/kbHelpers";

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

      <div className="mt-6 mb-9">
        <KBRenderer content={page?.body} />
      </div>
      <KBFooter />
    </div>
  );
};

export default KBPageViewMode;
