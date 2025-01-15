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
  Table,
} from "semantic-ui-react";
import { useModals } from "../../../context/ModalContext";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../api";
import { GenericKeyTextValueObj } from "../../../types";
import CtlTextArea from "../../ControlledInputs/CtlTextArea";
import { useEffect, useMemo, useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import LoadingSpinner from "../../LoadingSpinner";
import { useNotifications } from "../../../context/NotificationContext";
import "../Projects.css";

type PageMetadata = {
  id: string;
  title: string;
  summary: string;
  tags: GenericKeyTextValueObj<string>[];
};

interface AITagsModalProps {
  coverPageID: string;
  title: string;
}

const AITagsModal: React.FC<AITagsModalProps> = ({ coverPageID, title }) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const [showSummaryAI, setShowSummaryAI] = useState(false);
  const [showTagsAI, setShowTagsAI] = useState(false);
  const { closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const { control, setValue, getValues, watch } = useForm<PageMetadata[]>({});

  const { data, isLoading } = useQuery<PageMetadata[]>({
    queryKey: ["all-page-details", coverPageID],
    queryFn: async () => {
      const res = await api.getAllPageDetails(coverPageID);

      const mapped: PageMetadata[] = res.data.details.map((page) => ({
        id: page.id,
        title: page.title,
        summary: page.overview,
        tags: page.tags.map((tag) => ({
          key: tag["@id"],
          text: tag.title,
          value: tag.title,
        })),
      }));

      return mapped;
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!coverPageID,
  });

  //   const updatePageMutation = useMutation({
  //     mutationFn: async (data: PageMetadata) => {
  //       const tags = data.tags.map((tag) => tag.value);
  //       await api.updatePageDetails(`${library}-${pageID}`, coverPageID, {
  //         summary: data.summary,
  //         tags,
  //       });
  //     },
  //     onSettled: () => {
  //       queryClient.invalidateQueries(["page-details", library, pageID]); // Refresh the page details
  //       addNotification({
  //         type: "success",
  //         message: "Page metadata updated successfully",
  //       });
  //       closeAllModals();
  //     },
  //     onError: (error) => {
  //       handleGlobalError(error);
  //     },
  //   });

  //   useEffect(() => {
  //     if (!data) return;
  //     setValue("summary", data.summary);

  //     const sortedTags = () => {
  //       return data.tags.sort((a, b) => {
  //         // Sort disabled tags to the beginning
  //         if (isDisabledTag(a.value) && !isDisabledTag(b.value)) return -1;
  //         if (!isDisabledTag(a.value) && isDisabledTag(b.value)) return 1;
  //         return a.value.localeCompare(b.value);
  //       });
  //     };

  //     setValue("tags", sortedTags());
  //   }, [data]);

  //   const handleInsertTag = (tag: string) => {
  //     setValue("tags", [
  //       ...getValues("tags"),
  //       {
  //         key: tag,
  //         text: tag,
  //         value: tag,
  //       },
  //     ]);
  //   };

  //   const handleInsertAllTags = () => {
  //     setValue("tags", [
  //       ...getValues("tags"),
  //       ...displayTags.map((tag) => ({
  //         key: tag,
  //         text: tag,
  //         value: tag,
  //       })),
  //     ]);
  //   };

  //   const displayTags = useMemo(() => {
  //     if (!aiTags) return [];

  //     // Remove tags that are already in the list
  //     return aiTags?.tags.filter(
  //       (tag) => !getValues("tags").some((t) => t.value === tag)
  //     );
  //   }, [aiTags, watch("tags")]);

  //   const isDisabledTag = (value?: any): boolean => {
  //     return DISABLED_TAG_PREFIXES.some((prefix) =>
  //       value?.toString().startsWith(prefix)
  //     );
  //   };

  //   const handleSave = async (data: PageMetadata) => {
  //     if (data.summary.length > SUMMARY_MAX_LENGTH) {
  //       addNotification({
  //         type: "error",
  //         message: `Summary cannot be longer than ${SUMMARY_MAX_LENGTH} characters`,
  //       });
  //       return;
  //     }

  //     const tags = data.tags.map((tag) => tag.value) || [];
  //     if (tags.length > 100) {
  //       addNotification({
  //         type: "error",
  //         message: "Page cannot have more than 100 tags",
  //       });
  //       return;
  //     }

  //     await updatePageMutation.mutateAsync(data);
  //   };

  return (
    <Modal size="fullscreen" open={true} onClose={closeAllModals}>
      <Modal.Header>Edit Page Metadata: {title}</Modal.Header>
      <Modal.Content>
        {isLoading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!isLoading && (
          <>
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
            <Table celled>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Page Title</Table.HeaderCell>
                  <Table.HeaderCell>Tags</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data?.map((page) => (
                  <Table.Row key={page.id}>
                    <Table.Cell>{page.id}</Table.Cell>
                    <Table.Cell>
                      <Form>
                        <Controller
                          name={`tags[${page.id}]`}
                          control={control}
                          render={({ field }) => (
                            <Dropdown
                              {...field}
                              options={page.tags}
                              selection
                              multiple
                              search
                              allowAdditions
                              fluid
                              value={field.value}
                              onChange={(_, { value }) => field.onChange(value)}
                            />
                          )}
                        />
                      </Form>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
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
        <Button color="green">
          <Icon name="save" /> Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AITagsModal;
