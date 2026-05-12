import { useParams } from "react-router-dom";
import DefaultLayoutWNavTree from "../../../components/kb/DefaultLayoutWNavTree";
import { useEffect, useState, lazy } from "react";
import KBPageViewMode from "../../../components/kb/KBPageViewMode";
import { useTypedSelector } from "../../../state/hooks";
import { Button } from "@libretexts/davis-react";
import { IconPencil } from "@tabler/icons-react";
import { canEditKB } from "../../../utils/kbHelpers";
const KBPageEditMode = lazy(
  () => import("../../../components/kb/KBPageEditMode")
);

const KBPage = () => {
  const { slug } = useParams<{ slug: any }>();
  const user = useTypedSelector((state) => state.user);
  const [parsedSlug, setParsedSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view">("view");
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (typeof slug === "string" && slug !== "new") {
      setParsedSlug(slug);
    } else if (typeof slug === "string" && slug === "new") {
      setMode("create");
    }
  }, []);

  useEffect(() => {
    setCanEdit(canEditKB(user));
  }, [user]);

  const AdminOptions = () => {
    if (!canEdit) return null;
    return (
      <div className="flex flex-row justify-end mb-2">
        {mode === "view" && parsedSlug && (
          <Button
            variant="primary"
            size="md"
            icon={<IconPencil size={16} aria-hidden="true" />}
            onClick={() => setMode("edit")}
          >
            Edit This Page
          </Button>
        )}
      </div>
    );
  };

  return (
    <DefaultLayoutWNavTree>
      <AdminOptions />
      {mode === "view" && parsedSlug && (
        <KBPageViewMode slug={parsedSlug} canEdit={canEdit} />
      )}
      {["create", "edit"].includes(mode) && (
        <KBPageEditMode
          mode={mode}
          slug={parsedSlug}
          onSaved={() => setMode("view")}
        />
      )}
      <AdminOptions />
    </DefaultLayoutWNavTree>
  );
};

export default KBPage;
