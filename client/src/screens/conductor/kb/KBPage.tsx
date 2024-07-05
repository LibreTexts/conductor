import { useParams } from "react-router-dom";
import DefaultLayoutWNavTree from "../../../components/kb/DefaultLayoutWNavTree";
import { useEffect, useState, useRef, lazy } from "react";
import KBPageViewMode from "../../../components/kb/KBPageViewMode";
import { useTypedSelector } from "../../../state/hooks";
import { Button, Icon } from "semantic-ui-react";
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

  function switchToEditMode() {
    setMode("edit");
  }

  const AdminOptions = () => {
    return (
      <>
        {canEdit && (
          <div className="flex flex-row justify-end mb-2">
            {mode === "view" && parsedSlug && (
              <Button color="blue" onClick={switchToEditMode} size="small">
                <Icon name="edit" />
                Edit This Page
              </Button>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <DefaultLayoutWNavTree>
      <AdminOptions />
      {mode === "view" && parsedSlug && (
        <KBPageViewMode slug={parsedSlug} canEdit={canEdit} />
      )}
      {["create", "edit"].includes(mode) && (
        <KBPageEditMode mode={mode} slug={parsedSlug} />
      )}
      <AdminOptions />
    </DefaultLayoutWNavTree>
  );
};

export default KBPage;
