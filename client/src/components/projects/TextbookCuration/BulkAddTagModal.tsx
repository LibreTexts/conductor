import { useState } from "react";
import { Button, Checkbox, Icon, Modal, Table } from "semantic-ui-react";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { useFieldArray, useForm } from "react-hook-form";

interface BulkAddTagModalProps {
  pages: { id: string; title: string }[];
  onCancel: () => void;
  onConfirm: (pages: string[], tags: string[]) => void;
}

const BulkAddTagModal: React.FC<BulkAddTagModalProps> = ({
  pages: availablePages,
  onCancel,
  onConfirm,
}) => {
  const [pages, setPages] = useState<string[]>([]);

  // We can't use a simple string array for useFieldArray, so we need to use an object with an id and value
  const { control, watch, getValues, trigger } = useForm<{
    tags: { id: string; value: string }[];
  }>({
    defaultValues: {
      tags: [
        {
          id: crypto.randomUUID(),
          value: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: control,
    name: "tags",
  });

  const handleAddPage = (page: string) => {
    if (!pages.includes(page)) {
      setPages([...pages, page]);
    }
  };

  const handleRemovePage = (page: string) => {
    setPages(pages.filter((p) => p !== page));
  };

  const handleToggleSelectAll = () => {
    const anySelected = pages.length > 0;
    if (anySelected) {
      setPages([]);
    } else {
      setPages(availablePages.map((p) => p.id));
    }
  };

  const handleConfirm = async () => {
    const isValid = await trigger();
    if (!isValid) return;
    const tags = getValues().tags.map((t) => t.value.trim());
    onConfirm(pages, tags);
  };

  return (
    <Modal open={true} onClose={() => onCancel()} size="large">
      <Modal.Header>Bulk Add Tags</Modal.Header>
      <Modal.Content scrolling>
        <div className="mb-8">
          <p className="text-lg mb-3">
            Add tags to multiple pages at once. Enter the tags you want to add,
            then select the pages you want to add them to. This will not
            immediately save the tags to the pages, but adds them to your
            working changes so you can continue to edit before saving.
          </p>
          <Table celled className="!mt-1">
            <Table.Header fullWidth>
              <Table.Row key="header">
                <Table.HeaderCell>Tag</Table.HeaderCell>
                <Table.HeaderCell width={1}></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {fields.map((tag, index) => (
                <Table.Row key={tag.id}>
                  <Table.Cell>
                    <CtlTextInput
                      control={control}
                      name={`tags.${index}.value`}
                      fluid
                      maxLength={255}
                      rules={{ required: "Tag is required" }}
                      placeholder="Enter a tag"
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-row justify-end">
                      {
                        // If it's the last tag show the + button instead of the trash can
                        index === fields.length - 1 ? (
                          <Button
                            color="blue"
                            icon
                            disabled={!watch().tags[index].value}
                            onClick={() =>
                              append(
                                {
                                  id: crypto.randomUUID(),
                                  value: "",
                                },
                                { shouldFocus: false }
                              )
                            }
                          >
                            <Icon name="plus" />
                          </Button>
                        ) : null
                      }
                      {index > 0 ? (
                        <Button
                          color="red"
                          onClick={() => remove(index)}
                          icon="trash"
                        />
                      ) : null}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
        <div className="mt-4">
          <Table celled className="!mt-1">
            <Table.Header fullWidth>
              <Table.Row key="header">
                <Table.HeaderCell width={1}>
                  Selected
                  <Checkbox
                    className="pt-1"
                    checked={pages.length === availablePages.length}
                    onChange={handleToggleSelectAll}
                  />
                </Table.HeaderCell>
                <Table.HeaderCell>Page</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {availablePages.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>
                    <Checkbox
                      checked={pages.includes(p.id)}
                      onChange={() =>
                        pages.includes(p.id)
                          ? handleRemovePage(p.id)
                          : handleAddPage(p.id)
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-semibold">{p.title}</span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          color="green"
          onClick={handleConfirm}
          disabled={pages.length === 0}
        >
          Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default BulkAddTagModal;
