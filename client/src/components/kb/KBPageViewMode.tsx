import { useParams } from "react-router-dom";
import useGlobalError from "../../components/error/ErrorHooks";
import { useEffect, useState } from "react";
import axios from "axios";
import { KBPage } from "../../types";
import KBRenderer from "./KBRenderer";
import PageLastEditor from "./PageLastEditor";

const KBPageViewMode = ({ id }: { id?: string | null }) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<KBPage | null>(null);

  useEffect(() => {
    if (id) {
      loadPage();
    }
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      const res = await axios.get(`/kb/page/${id}`);
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
      <div className="flex flex-row justify-between">
        <p className="text-4xl font-semibold">{page?.title}</p>
      </div>
      <PageLastEditor lastEditedBy={page?.lastEditedBy} updatedAt={page?.updatedAt} />
      <p className="mt-2"><span className="font-medium">Description</span>: <span className="italic">{page?.description}</span></p>
      <div className="my-8">
        <KBRenderer content={page?.body} />
      </div>
    </div>
  );
};

export default KBPageViewMode;
