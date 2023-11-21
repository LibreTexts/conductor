import { Button, Icon, Message } from "semantic-ui-react";
import useGlobalError from "../../components/error/ErrorHooks";
import { useEffect, useState, lazy } from "react";
import axios from "axios";
import { useTypedSelector } from "../../state/hooks";
import { get, useForm } from "react-hook-form";
import { KBPage } from "../../types";
import KBQuillEditor from "./KBQuillEditor";
import PreviewPageModal from "./PreviewPageModal";
import PageLastEditor from "./PageLastEditor";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import useQueryParam from "../../utils/useQueryParam";
import PageStatusLabel from "./PageStatusLabel";
import { checkIsUUID, getKBSharingObj } from "../../utils/kbHelpers";
const ConfirmDeletePageModal = lazy(() => import("./ConfirmDeletePageModal"));

const KBPageEditMode = ({
  mode,
  slug,
  onDataChanged,
}: {
  mode: "create" | "edit" | "view";
  slug?: string | null;
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
        slug: "",
      },
    });

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (mode === "edit" && slug) {
      loadPage();
    }
    if (mode === "create" && parentQueryParam) {
      setValue("parent", parentQueryParam);
    }
  }, []);

  async function loadPage() {
    try {
      const isUUID = checkIsUUID(slug);

      setLoading(true);
      const res = await axios.get(`/kb/page/${isUUID ? `${slug}` : `slug/${slug}`}`);
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
    if (!await trigger()) return;
    if (mode === "edit") {
      handleUpdate(status);
    } else {
      handleCreate(status);
    }
  }

  async function handleCreate(status: "published" | "draft") {
    try {
      setLoading(true);
      _checkSlug();

      const res = await axios.post("/kb/page", {
        ...getValues(),
        status,
        lastEditedBy: user.uuid,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.page || !res.data.page.slug) {
        throw new Error("Error creating page");
      }
      window.location.assign(`/kb/${res.data.page.slug}`); // Redirect to new page
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(status: "published" | "draft") {
    try {
      setLoading(true);
      if (!getValues('uuid')) return;
      _checkSlug();

      console.log(getValues('body'))

      const res = await axios.patch(`/kb/page/${getValues('uuid')}`, {
        ...getValues(),
        status,
        lastEditedBy: user.uuid,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      setSaveSuccess(true);
      loadPage();
      if (onDataChanged) {
        onDataChanged();
      }
      window.scrollTo(0, 0);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function _checkSlug() {
    if (getValues('slug') && ['new', 'edit', 'create', 'welcome'].includes(getValues('slug'))) {
      throw new Error("Slug cannot be reserved word ('new', 'edit', 'create', 'welcome')");
    }
  }

  const EditorOptions = ({ editMode }: { editMode: boolean }) => {
    return (
      <div className="flex flex-row">
        {editMode && (
          <>
            <Button
              color="red"
              loading={loading}
              onClick={() => setShowDeleteModal(true)}
              size="mini"
            >
              <Icon name="trash" />
              Delete
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
        <div className="flex flex-row items-center">
          <p className="text-3xl font-semibold">
            {mode === "edit" ? (
              <span>
                Editing Page: <em>{getValues("title")}</em>
              </span>
            ) : (
              <span>Create New Page</span>
            )}
          </p>
          <PageStatusLabel status={getValues("status")} />
        </div>
        <EditorOptions editMode={mode === "edit"} />
      </div>
      <p className="text-sm text-gray-500">
        {mode === "edit" && <span>Page ID: {getValues("uuid")}</span>}
        {["create", "edit"].includes(mode) && getValues("parent") && (
          <>
            {mode === "edit" && <span className="mx-1">|</span>}
            <span>Parent ID: {getValues("parent")}</span>
          </>
        )}
      </p>
      {mode === "edit" && (
        <PageLastEditor
          lastEditedBy={getValues("lastEditedBy")}
          updatedAt={getValues("updatedAt")}
        />
      )}
      <div className="flex flex-col my-8">
        <div className="mb-4">
          <CtlTextInput
            control={control}
            name="title"
            label="Title (max 100 characters)"
            placeholder="Page Title"
            rules={required}
            required
            fluid
            maxLength={100}
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
        <div className="mb-4">
          <CtlTextInput
            control={control}
            name="slug"
            label="URL Slug (optional) (ex: my-page-title)"
            placeholder="URL slug of the page. Leave blank to auto-generate."
            fluid
          />
          <p className="text-xs text-gray-500 italic">
            If you leave this blank, the URL slug will be auto-generated based
            on the page title. If you provide a slug, it must be unique and
            will be parsed and safely encoded by the system. Use caution when
            changing an existing slug as it may break existing links.
          </p>
        </div>

        <div className="mt-8">
          <p className="form-field-label mb-1">Content</p>
          <KBQuillEditor
            data={watch("body")}
            pageUUID={watch("uuid")}
            onDataChange={(newData: string) => {
              setValue("body", newData);
            }}
          />
        </div>
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
      {getValues('uuid') && (
        <ConfirmDeletePageModal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => window.location.assign("/insight/welcome")}
          uuid={getValues("uuid")}
        />
      )}
    </div>
  );
};

export default KBPageEditMode;
