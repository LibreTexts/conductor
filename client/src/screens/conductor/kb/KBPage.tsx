import { useParams } from "react-router-dom";
import DefaultLayoutWNavTree from "../../../components/kb/DefaultLayoutWNavTree";
import { useEffect, useState, useRef } from "react";
import KBPageViewMode from "../../../components/kb/KBPageViewMode";
import KBPageEditMode from "../../../components/kb/KBPageEditMode";
import { useTypedSelector } from "../../../state/hooks";
import { Button, Icon } from "semantic-ui-react";

const KBPage = () => {
  const { id } = useParams<{ id: any }>();
  const defaultLayoutRef = useRef<{ loadTree: () => void }>();
  const user = useTypedSelector((state) => state.user);
  const [parsedID, setParsedID] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view">("view");

  useEffect(() => {
    if (typeof id === "string" && id !== "new") {
      setParsedID(id);
    } else if (typeof id === "string" && id === "new") {
      setMode("create");
    }
  }, []);

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
        {user && user.isSuperAdmin && (
          <div className="flex flex-row justify-end">
            {mode === "view" && parsedID && (
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
      {mode === "view" && parsedID && (
        <KBPageViewMode id={parsedID} canEdit={user && user.isSuperAdmin} />
      )}
      {["create", "edit"].includes(mode) && (
        <KBPageEditMode
          mode={mode}
          id={parsedID}
          onDataChanged={() => handleDataChanged()}
        />
      )}
      <AdminOptions />
    </DefaultLayoutWNavTree>
  );
};

export default KBPage;
