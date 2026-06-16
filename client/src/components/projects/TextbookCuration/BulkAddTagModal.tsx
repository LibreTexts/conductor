import { useState } from "react";
import { Button, Checkbox, Modal } from "@libretexts/davis-react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
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

  const { control, watch, getValues, trigger } = useForm<{
    tags: { id: string; value: string }[];
  }>({
    defaultValues: {
      tags: [{ id: crypto.randomUUID(), value: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "tags" });

  const handleAddPage = (page: string) => {
    if (!pages.includes(page)) setPages([...pages, page]);
  };

  const handleRemovePage = (page: string) => {
    setPages(pages.filter((p) => p !== page));
  };

  const handleToggleSelectAll = () => {
    if (pages.length > 0) {
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
    <Modal open={true} onClose={(v) => !v && onCancel()} size="lg">
      <Modal.Header>
        <Modal.Title>Bulk Add Tags</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-8">
          <p className="text-lg mb-3">
            Add tags to multiple pages at once. Enter the tags you want to add,
            then select the pages you want to add them to. This will not
            immediately save the tags to the pages, but adds them to your
            working changes so you can continue to edit before saving.
          </p>
          <table className="w-full border border-gray-200 rounded text-sm mt-1">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold">Tag</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((tag, index) => (
                <tr key={tag.id} className="border-b border-gray-200 last:border-0">
                  <td className="px-3 py-2">
                    <CtlTextInput
                      control={control}
                      name={`tags.${index}.value`}
                      fluid
                      maxLength={255}
                      rules={{ required: "Tag is required" }}
                      placeholder="Enter a tag"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-row gap-1 justify-start">
                      {(index > 0 || fields.length > 1) && (
                        <Button
                          variant="destructive"
                          icon={<IconTrash size={14} />}
                          onClick={() => remove(index)}
                        />
                      )}
                      {index === fields.length - 1 && (
                        <Button
                          variant="primary"
                          icon={<IconPlus size={14} />}
                          disabled={!watch().tags[index].value}
                          onClick={() =>
                            append({ id: crypto.randomUUID(), value: "" }, { shouldFocus: false })
                          }
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <table className="w-full border border-gray-200 rounded text-sm mt-1">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold w-28">
                  <div className="flex flex-col gap-1">
                    Selected
                    <Checkbox
                      name="selectAll"
                      checked={pages.length === availablePages.length}
                      onChange={handleToggleSelectAll}
                    />
                  </div>
                </th>
                <th className="text-left px-3 py-2 font-semibold">Page</th>
              </tr>
            </thead>
            <tbody>
              {availablePages.map((p) => (
                <tr key={p.id} className="border-b border-gray-200 last:border-0">
                  <td className="px-3 py-2">
                    <Checkbox
                      name={`page-${p.id}`}
                      checked={pages.includes(p.id)}
                      onChange={(checked) =>
                        checked ? handleAddPage(p.id) : handleRemovePage(p.id)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold">{p.title}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={pages.length === 0}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkAddTagModal;
