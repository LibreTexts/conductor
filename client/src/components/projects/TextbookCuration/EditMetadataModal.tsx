import {
  Button,
  Divider,
  Dropdown,
  Form,
  Icon,
  Label,
  Modal,
  Popup,
  Segment,
} from "semantic-ui-react";
import { useModals } from "../../../context/ModalContext";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../api";
import { GenericKeyTextValueObj } from "../../../types";
import CtlTextArea from "../../ControlledInputs/CtlTextArea";
import { useEffect, useMemo, useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import LoadingSpinner from "../../LoadingSpinner";
import { useNotifications } from "../../../context/NotificationContext";
import "../Projects.css";
import { DISABLED_PAGE_TAG_PREFIXES } from "../../../utils/misc";
const SUMMARY_MAX_LENGTH = 500;

type PageMetadata = {
  summary: string;
  tags: GenericKeyTextValueObj<string>[];
};

interface EditMetadataModalProps {
  library: string;
  pageID: string;
  coverPageID: string;
  title: string;
}

/**
 * @deprecated
 * This component is probably useless now, but leaving here for reference
 */
const EditMetadataModal: React.FC<EditMetadataModalProps> = ({
  library,
  pageID,
  coverPageID,
  title,
}) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const [showSummaryAI, setShowSummaryAI] = useState(false);
  const [showTagsAI, setShowTagsAI] = useState(false);
  const { closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const { control, setValue, getValues, watch } = useForm<PageMetadata>({
    defaultValues: {
      summary: "",
      tags: [],
    },
  });

  const { data, isLoading } = useQuery<PageMetadata>({
    queryKey: ["page-details", library, pageID],
    queryFn: async () => {
      const res = await api.getPageDetails(`${library}-${pageID}`, coverPageID);

      const mappedTags = res.data.tags.map((tag) => ({
        key: tag["@id"],
        text: tag.title,
        value: tag.title,
      }));
      return {
        summary: res.data.overview,
        tags: mappedTags,
      };
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !!library && !!pageID,
  });

  const {
    data: aiSummary,
    isLoading: aiSummaryLoading,
    refetch: refetchAISummary,
  } = useQuery<{ summary: string }>({
    queryKey: ["ai-summary", library, pageID],
    queryFn: async () => {
      const res = await api.getPageAISummary(
        `${library}-${pageID}`,
        coverPageID
      );
      return res.data;
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: showSummaryAI,
  });

  const {
    data: aiTags,
    isLoading: aiTagsLoading,
    refetch: refetchAITags,
  } = useQuery<{ tags: string[] }>({
    queryKey: ["ai-tags", library, pageID],
    queryFn: async () => {
      const res = await api.getPageAITags(`${library}-${pageID}`, coverPageID);
      return res.data;
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: showTagsAI,
  });

  const updatePageMutation = useMutation({
    mutationFn: async (data: PageMetadata) => {
      const tags = data.tags.map((tag) => tag.value);
      await api.updatePageDetails(`${library}-${pageID}`, coverPageID, {
        summary: data.summary,
        tags,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(["page-details", library, pageID]); // Refresh the page details
      addNotification({
        type: "success",
        message: "Page metadata updated successfully",
      });
      closeAllModals();
    },
    onError: (error) => {
      handleGlobalError(error);
    },
  });

  useEffect(() => {
    if (!data) return;
    setValue("summary", data.summary);

    const sortedTags = () => {
      return data.tags.sort((a, b) => {
        // Sort disabled tags to the beginning
        if (isDisabledTag(a.value) && !isDisabledTag(b.value)) return -1;
        if (!isDisabledTag(a.value) && isDisabledTag(b.value)) return 1;
        return a.value.localeCompare(b.value);
      });
    };

    setValue("tags", sortedTags());
  }, [data]);

  const handleInsertSummary = () => {
    if (!aiSummary?.summary) return;
    setValue("summary", aiSummary?.summary);
    setShowSummaryAI(false);
  };

  const handleInsertTag = (tag: string) => {
    setValue("tags", [
      ...getValues("tags"),
      {
        key: tag,
        text: tag,
        value: tag,
      },
    ]);
  };

  const handleInsertAllTags = () => {
    setValue("tags", [
      ...getValues("tags"),
      ...displayTags.map((tag) => ({
        key: tag,
        text: tag,
        value: tag,
      })),
    ]);
  };

  const displayTags = useMemo(() => {
    if (!aiTags) return [];

    // Remove tags that are already in the list
    return aiTags?.tags.filter(
      (tag) => !getValues("tags").some((t) => t.value === tag)
    );
  }, [aiTags, watch("tags")]);

  const isDisabledTag = (value?: any): boolean => {
    return DISABLED_PAGE_TAG_PREFIXES.some((prefix) =>
      value?.toString().startsWith(prefix)
    );
  };

  const handleSave = async (data: PageMetadata) => {
    if (data.summary.length > SUMMARY_MAX_LENGTH) {
      addNotification({
        type: "error",
        message: `Summary cannot be longer than ${SUMMARY_MAX_LENGTH} characters`,
      });
      return;
    }

    const tags = data.tags.map((tag) => tag.value) || [];
    if (tags.length > 100) {
      addNotification({
        type: "error",
        message: "Page cannot have more than 100 tags",
      });
      return;
    }

    await updatePageMutation.mutateAsync(data);
  };

  return (
    <Modal size="large" open={true} onClose={closeAllModals}>
      <Modal.Header>Edit Page Metadata: {title}</Modal.Header>
      <Modal.Content>
        {isLoading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!isLoading && (
          <>
            <p className="text-lg font-semibold mb-2">Summary</p>
            <CtlTextArea
              control={control}
              name="summary"
              placeholder="Enter a summary for this page"
              rows={4}
              fluid
              bordered
              className="mb-4"
              disabled={isLoading || updatePageMutation.isLoading}
              showRemaining
              maxLength={500}
            />
            {showSummaryAI && (
              <Segment
                loading={aiSummaryLoading}
                className="!shadow-sm !shadow-blue-400"
              >
                <p> {aiSummary?.summary}</p>
                <div className="mt-4 flex">
                  <Button color="grey" onClick={() => setShowSummaryAI(false)}>
                    <Icon name="cancel" />
                    Cancel
                  </Button>
                  <Button
                    color="teal"
                    onClick={() => refetchAISummary()}
                    loading={aiSummaryLoading}
                  >
                    <Icon name="refresh" />
                    Generate Again
                  </Button>
                  {aiSummary?.summary && (
                    <Button color="green" onClick={handleInsertSummary}>
                      <Icon name="plus" />
                      Insert
                    </Button>
                  )}
                </div>
              </Segment>
            )}
            {!showSummaryAI && (
              <Button
                color="blue"
                className="mt-2"
                onClick={() => setShowSummaryAI(true)}
              >
                <Icon name="magic" />
                Generate with AI
              </Button>
            )}
            <Divider className="!mt-8" />
            <p className="text-lg font-semibold mb-2">
              Tags
              <Popup
                trigger={
                  <Icon
                    name="info circle"
                    size="small"
                    className="!mr-0 !ml-1"
                  />
                }
                content="Tags are used to categorize and organize pages. Some tags are not editable because they are used for specific system functions."
              />
            </p>
            <Form.Field className="flex flex-col">
              <Controller
                render={({ field }) => (
                  <Dropdown
                    id="pageTags"
                    placeholder="Search tags..."
                    options={watch("tags")}
                    {...field}
                    onChange={(e, { value }) => {
                      field.onChange(value as string);
                    }}
                    value={field.value.map((tag) => tag.value)}
                    fluid
                    selection
                    multiple
                    max
                    loading={isLoading}
                    renderLabel={(tag) => ({
                      color: "blue",
                      content: tag.text,
                      className: isDisabledTag(tag.value) ? "hidden" : "",
                      onRemove: (e: any, data: any) => {
                        e.stopPropagation();
                        if (isDisabledTag(data.value)) return;

                        // remove only the tag that was clicked
                        field.onChange(
                          field.value.filter((t) => t.value !== data.value)
                        );
                      },
                    })}
                    disabled={isLoading || updatePageMutation.isLoading}
                  />
                )}
                name="tags"
                control={control}
              />
            </Form.Field>
            {showTagsAI && (
              <Segment
                loading={aiTagsLoading}
                className="!shadow-sm !shadow-blue-400"
              >
                <div className="flex flex-wrap space-y-2 items-center">
                  {displayTags.length === 0 && (
                    <p className="text-center text-slate-500 italic">
                      No tags available
                    </p>
                  )}
                  {displayTags.map((tag) => (
                    <Label
                      key={crypto.randomUUID()}
                      color="blue"
                      className="mr-2 cursor-pointer mb-2 flex-shrink-0"
                      onClick={(e) => handleInsertTag(tag)}
                    >
                      {tag}
                      <Icon name="plus" className="pl-2" size="small" />
                    </Label>
                  ))}
                </div>
                <div className="mt-4 flex">
                  <Button color="grey" onClick={() => setShowTagsAI(false)}>
                    <Icon name="cancel" />
                    Cancel
                  </Button>
                  <Button
                    color="teal"
                    onClick={() => refetchAITags()}
                    loading={aiTagsLoading}
                  >
                    <Icon name="refresh" />
                    Generate Again
                  </Button>
                  {displayTags.length > 0 && (
                    <Button color="green" onClick={handleInsertAllTags}>
                      <Icon name="plus" />
                      Add All
                    </Button>
                  )}
                </div>
              </Segment>
            )}
            {!showTagsAI && (
              <Button
                color="blue"
                className="!mt-4"
                onClick={() => setShowTagsAI(true)}
              >
                <Icon name="magic" />
                Generate with AI
              </Button>
            )}
            <p className="text-sm text-center text-slate-500 italic px-12 mt-6">
              Caution: AI-generated output may not always be accurate. Please
              thoroughly review content before saving. LibreTexts is not
              responsible for any inaccuracies in AI-generated content.
            </p>
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button color="grey" onClick={closeAllModals}>
          Cancel
        </Button>
        <Button
          color="green"
          onClick={() => {
            handleSave(getValues());
          }}
          loading={updatePageMutation.isLoading}
          disabled={
            (watch("summary") &&
              watch("summary").length > SUMMARY_MAX_LENGTH) ||
            (watch("tags") && watch("tags").length > 100)
          }
        >
          <Icon name="save" /> Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditMetadataModal;
