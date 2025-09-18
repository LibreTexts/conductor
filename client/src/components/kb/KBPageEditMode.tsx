import { Button, Icon, Message } from "semantic-ui-react";
import useGlobalError from "../../components/error/ErrorHooks";
import { useEffect, useState, lazy } from "react";
import axios from "axios";
import { useTypedSelector } from "../../state/hooks";
import { get, useForm } from "react-hook-form";
import { KBPage } from "../../types";
import PageLastEditor from "./PageLastEditor";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import useQueryParam from "../../utils/useQueryParam";
import PageStatusLabel from "./PageStatusLabel";
import { checkIsUUID, getKBSharingObj } from "../../utils/kbHelpers";
import { useQueryClient } from "@tanstack/react-query";

const KBCKEditor = lazy(() => import("./KBCKEditor"));
const PreviewPageModal = lazy(() => import("./PreviewPageModal"));
const ConfirmDeletePageModal = lazy(() => import("./ConfirmDeletePageModal"));

const KBPageEditMode = ({
  mode,
  slug,
  onSaved
}: {
  mode: "create" | "edit" | "view";
  slug?: string | null;
  onSaved: () => void;
}) => {
  const { handleGlobalError } = useGlobalError();
  const queryClient = useQueryClient();
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
      const res = await axios.get(
        `/kb/page/${isUUID ? `${slug}` : `slug/${slug}`}`
      );
      
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
    if (!(await trigger())) return;
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
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.page || !res.data.page.slug) {
        throw new Error("Error creating page");
      }

      // Invalidate nav tree cache
      queryClient.invalidateQueries({
        queryKey: ["nav-tree"],
      });

      window.location.assign(`/insight/${res.data.page.slug}`); // Redirect to new page
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(status: "published" | "draft") {
    try {
      setLoading(true);
      if (!getValues("uuid")) return;
      _checkSlug();

      const res = await axios.patch(`/kb/page/${getValues("uuid")}`, {
        ...getValues(),
        status,
        lastEditedBy: user.uuid,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.page) {
        throw new Error("Invalid response from server.");
      }

      const updated = res.data.page;
      setSaveSuccess(true);

      // Invalidate nav tree cache
      queryClient.invalidateQueries({
        queryKey: ["nav-tree"],
      });

      // Redirect if slug has changed
      const currentSlug = window.location.pathname.split("/").pop();
      if(currentSlug !== updated.slug) {
        window.location.assign(`/insight/${updated.slug}`);
        return;
      }

      onSaved();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function _checkSlug() {
    if (
      getValues("slug") &&
      ["new", "edit", "create", "welcome"].includes(getValues("slug").trim())
    ) {
      throw new Error(
        "Slug cannot be reserved word ('new', 'edit', 'create', 'welcome')"
      );
    }
  }

  const EditorOptions = ({ editMode }: { editMode: boolean }) => {
    return (
      <div className="flex flex-row h-8">
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
        {mode === "edit" && (
          <Button
            color="green"
            loading={loading}
            onClick={() => handleSave("published")}
            size="mini"
          >
            <Icon name="save" />
            Save & Publish
          </Button>
        )}
        <Button
          color={editMode ? "blue" : "green"}
          basic={editMode}
          loading={loading}
          onClick={() => handleSave("draft")}
          size="mini"
        >
          <Icon name="save" />
          {editMode ? "Save as Draft" : "Create Draft"}
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
          <div className="flex flex-row max-w-3xl">
            <p className="text-3xl font-semibold">
              {mode === "edit" ? (
                <span>
                  Editing Page: <em>{getValues("title")}</em>
                </span>
              ) : (
                <span>Create New Page</span>
              )}
            </p>
          </div>
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
        <div className="flex flex-row">
          <PageLastEditor
            lastEditedBy={getValues("lastEditedBy")}
            updatedAt={getValues("updatedAt")}
          />
          <PageStatusLabel status={getValues("status")} className="!mt-0.5" />
        </div>
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
          <p className="text-xs text-gray-500 italic ml-1">
            If you leave this blank, the URL slug will be auto-generated based
            on the page title. If you provide a slug, it must be unique and will
            be parsed and safely encoded by the system. Use caution when
            changing an existing slug as it may break existing links.
          </p>
        </div>

        <div className="mt-8">
          <p className="form-field-label mb-1">Content</p>
          {watch("uuid") ? (
            <KBCKEditor
              data={watch("body")}
              pageUUID={watch("uuid")}
              onDataChange={(newData: string) => {
                setValue("body", newData);
              }}
            />
          ) : (
            <p className="text-sm text-gray-500">
              Save this page first to start editing the content.
            </p>
          )}
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
      {getValues("uuid") && (
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
