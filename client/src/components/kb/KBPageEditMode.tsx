import { Button, Icon, Message } from "semantic-ui-react";
import useGlobalError from "../../components/error/ErrorHooks";
import { useEffect, useState } from "react";
import axios from "axios";
import { useTypedSelector } from "../../state/hooks";
import { get, useForm } from "react-hook-form";
import { KBPage } from "../../types";
import KBCKEditor from "./KBQuillEditor";
import PreviewPageModal from "./PreviewPageModal";
import PageLastEditor from "./PageLastEditor";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import useQueryParam from "../../utils/useQueryParam";

const KBPageEditMode = ({
  mode,
  id,
  onDataChanged
}: {
  mode: "create" | "edit" | "view";
  id?: string | null;
  onDataChanged?: () => void;
}) => {
  const { handleGlobalError } = useGlobalError();
  const parentQueryParam = useQueryParam("parent");
  const user = useTypedSelector((state) => state.user);
  const { control, getValues, setValue, reset, trigger, watch } =
    useForm<KBPage>({
      defaultValues: {
        title: "",
        description: "",
        body: "",
      },
    });

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (mode === "edit" && id) {
      loadPage();
    }
    if (mode === "create" && parentQueryParam) {
      setValue("parent", parentQueryParam);
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

      reset(res.data.page);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(status: "published" | "draft") {
    if (mode === "edit") {
      handleUpdate(status);
    } else {
      handleCreate(status);
    }
  }

  async function handleCreate(status: "published" | "draft") {
    try {
      setLoading(true);

      const res = await axios.post("/kb/page", {
        ...getValues(),
        status,
        lastEditedBy: user.uuid,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      setSaveSuccess(true);
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(status: "published" | "draft") {
    try {
      setLoading(true);

      const res = await axios.patch(`/kb/page/${id}`, {
        ...getValues(),
        status,
        lastEditedBy: user.uuid,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      setSaveSuccess(true);
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenPublicPage() {
    window.open(`/kb/page/${id}`, "_blank");
  }

  const EditorOptions = ({ editMode }: { editMode: boolean }) => {
    return (
      <div className="flex flex-row">
        {editMode && (
          <>
            <Button
              loading={loading}
              onClick={handleOpenPublicPage}
              size="mini"
            >
              <Icon name="external" />
              View Public Page
            </Button>
            <Button
              color="purple"
              loading={loading}
              onClick={() => setShowPreview(true)}
              size="mini"
            >
              <Icon name="eye" />
              Preview
            </Button>
          </>
        )}
        <Button
          color="blue"
          loading={loading}
          onClick={() => handleSave("published")}
          size="mini"
        >
          <Icon name="save" />
          {mode === "edit" ? "Save & Publish" : "Create & Publish"}
        </Button>
        <Button
          color="green"
          loading={loading}
          onClick={() => handleSave("draft")}
          size="mini"
        >
          <Icon name="save" />
          {mode === "edit" ? "Save as Draft" : "Create as Draft"}
        </Button>
      </div>
    );
  };

  return (
    <div>
      {saveSuccess && (
        <Message color="green" onDismiss={() => setSaveSuccess(false)}>
          <Icon name="save" />
          Page saved successfully!
        </Message>
      )}
      <div className="flex flex-row justify-between">
        <p className="text-3xl font-semibold">
          {mode === "edit" ? (
            <span>Editing Page: {getValues("title")}</span>
          ) : (
            <span>Create New Page</span>
          )}
        </p>
        <EditorOptions editMode={mode === "edit"} />
      </div>
      {mode === "edit" && (
        <p className="text-sm text-gray-500">Page ID: {getValues("uuid")}</p>
      )}
      {["create", "edit"].includes(mode) && (
        <p className="text-sm text-gray-500">
          Parent ID: {getValues("parent")}
        </p>
      )}
      {mode === "edit" && (
        <PageLastEditor lastEditedBy={getValues("lastEditedBy")} />
      )}
      <div className="flex flex-col my-8">
        <div className="mb-4">
          <CtlTextInput
            control={control}
            name="title"
            label="Title"
            placeholder="Page Title"
            rules={required}
            required
            fluid
          />
        </div>
        <div className="mb-4">
          <CtlTextInput
            control={control}
            name="description"
            label="Description (max 200 characters)"
            placeholder="Brief description of the page"
            rules={required}
            required
            fluid
            maxLength={200}
          />
        </div>

        <p className="form-field-label mb-1">Content</p>
        <KBCKEditor
          data={watch("body")}
          onDataChange={(newData: string) => {
            setValue("body", newData);
          }}
        />
      </div>
      <div className="flex flex-row justify-end mt-6">
        <EditorOptions editMode={mode === "edit"} />
      </div>
      <PreviewPageModal
        show={showPreview}
        onClose={() => setShowPreview(false)}
        title={getValues("title")}
        content={getValues("body")}
      />
    </div>
  );
};

export default KBPageEditMode;
