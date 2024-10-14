import {
  Button,
  Divider,
  Dropdown,
  Form,
  Icon,
  Label,
  Loader,
  Modal,
  Segment,
} from "semantic-ui-react";
import { useModals } from "../../../../context/ModalContext";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import { GenericKeyTextValueObj, PageTag } from "../../../../types";
import CtlTextArea from "../../../ControlledInputs/CtlTextArea";
import { useEffect, useMemo, useState } from "react";
import useGlobalError from "../../../error/ErrorHooks";
import LoadingSpinner from "../../../LoadingSpinner";
import { useNotifications } from "../../../../context/NotificationContext";

type PageMetadata = {
  summary: string;
  tags: GenericKeyTextValueObj<string>[];
};

interface EditMetadataModalProps {
  library: string;
  pageID: string;
  title: string;
}

const EditMetadataModal: React.FC<EditMetadataModalProps> = ({
  library,
  pageID,
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
      const res = await api.getPageDetails(`${library}-${pageID}`);

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
      const res = await api.getPageAISummary(`${library}-${pageID}`);
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
      const res = await api.getPageAITags(`${library}-${pageID}`);
      return res.data;
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: showTagsAI,
  });

  const updatePageMutation = useMutation({
    mutationFn: async (data: PageMetadata) => {
      const tags = data.tags.map((tag) => tag.value);
      await api.updatePageDetails(`${library}-${pageID}`, {
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
    setValue("tags", data.tags);
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

  const displayTags = useMemo(() => {
    if (!aiTags) return [];

    // Remove tags that are already in the list
    return aiTags?.tags.filter(
      (tag) => !getValues("tags").some((t) => t.value === tag)
    );
  }, [aiTags, watch("tags")]);

  return (
    <Modal size="large" open={true}>
      <Modal.Header>Edit Page Metadata: {title}</Modal.Header>
      <Modal.Content>
        {isLoading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!isLoading && (
          <>
            <p className="text-lg font-semibold mb-2">Summary:</p>
            <CtlTextArea
              control={control}
              name="summary"
              placeholder="Enter a summary for this page"
              rows={4}
              fluid
              bordered
              className="mb-4"
              disabled={isLoading || updatePageMutation.isLoading}
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
                    Regenerate
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
            <Divider />
            <p className="text-lg font-semibold mb-2">Tags:</p>

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
                    loading={isLoading}
                    renderLabel={(tag) => ({
                      color: "blue",
                      content: tag.text,
                      onRemove: (e: any, data: any) => {
                        e.stopPropagation();

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
                    Regenerate
                  </Button>
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
            updatePageMutation.mutate(getValues());
          }}
          loading={updatePageMutation.isLoading}
        >
          <Icon name="save" /> Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditMetadataModal;
