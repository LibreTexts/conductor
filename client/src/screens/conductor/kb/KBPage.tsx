import { useParams } from "react-router-dom";
import DefaultLayoutWNavTree from "../../../components/kb/DefaultLayoutWNavTree";
import { useEffect, useState, useRef } from "react";
import KBPageViewMode from "../../../components/kb/KBPageViewMode";
import KBPageEditMode from "../../../components/kb/KBPageEditMode";
import { useTypedSelector } from "../../../state/hooks";
import { Button, Icon } from "semantic-ui-react";
import { canEditKB } from "../../../utils/kbHelpers";

const KBPage = () => {
  const { slug } = useParams<{ slug: any }>();
  const defaultLayoutRef = useRef<{ loadTree: () => void }>();
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

  function handleDataChanged() {
    if (defaultLayoutRef.current) {
      defaultLayoutRef.current.loadTree();
    }
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
    <DefaultLayoutWNavTree ref={defaultLayoutRef}>
      <AdminOptions />
      {mode === "view" && parsedSlug && (
        <KBPageViewMode slug={parsedSlug} canEdit={canEdit} />
      )}
      {["create", "edit"].includes(mode) && (
        <KBPageEditMode
          mode={mode}
          slug={parsedSlug}
          onDataChanged={() => handleDataChanged()}
        />
      )}
      <AdminOptions />
    </DefaultLayoutWNavTree>
  );
};

export default KBPage;
