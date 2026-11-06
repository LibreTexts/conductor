import { useEffect, useState } from "react";
import { Modal, Button, Checkbox } from "@libretexts/davis-react";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { KBPage } from "../../types";

type KBSubpage = Pick<KBPage, "uuid" | "title" | "slug" | "parent">;

interface ConfirmDeletePageModalProps {
  open: boolean;
  uuid: string;
  onClose: () => void;
  onDeleted: () => void;
}

const ConfirmDeletePageModal: React.FC<ConfirmDeletePageModalProps> = ({
  open,
  onClose,
  uuid,
  onDeleted,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const {
    data: subpages,
    isLoading: subpagesLoading,
    isError: subpagesError,
  } = useQuery<KBSubpage[]>({
    queryKey: ["kb-page-subpages", uuid],
    queryFn: async () => {
      const res = await axios.get(`/kb/page/${uuid}/subpages`);
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data.subpages ?? [];
    },
    enabled: open && !!uuid,
    staleTime: 0,
  });

  const hasSubpages = (subpages?.length ?? 0) > 0;

  useEffect(() => {
    if (!open) setAcknowledged(false);
  }, [open]);

  async function handleDelete() {
    try {
      setLoading(true);
      if (!uuid) return;
      const res = await axios.delete(`/kb/page/${uuid}`, {
        params: hasSubpages ? { cascade: "true" } : undefined,
      });
      if (res.data.err) throw new Error(res.data.errMsg);
      onDeleted();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose()} size="sm">
      <Modal.Header>
        <Modal.Title>Delete Page?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Are you sure you want to delete this page?{" "}
          <strong>This action cannot be undone.</strong>
        </p>
        {subpagesError && (
          <p className="mt-3 text-red-700" role="alert">
            Couldn't check this page for subpages. Close this dialog and try
            again.
          </p>
        )}
        {hasSubpages && (
          <div className="mt-4">
            <p className="font-semibold">
              {subpages!.length === 1
                ? "This page has 1 subpage, which will also be deleted:"
                : `This page has ${subpages!.length} subpages, which will also be deleted:`}
            </p>
            <ul className="mt-2 mb-4 list-disc pl-6 max-h-48 overflow-y-auto">
              {subpages!.map((subpage) => (
                <li key={subpage.uuid}>{subpage.title}</li>
              ))}
            </ul>
            <Checkbox
              name="kb-delete-acknowledge-subpages"
              label="I understand that this will delete all subpages"
              checked={acknowledged}
              onChange={setAcknowledged}
              required
            />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="destructive"
          icon={<IconTrash size={16} aria-hidden="true" />}
          loading={loading}
          disabled={
            subpagesLoading || subpagesError || (hasSubpages && !acknowledged)
          }
          onClick={handleDelete}
        >
          Delete
        </Button>
        <Button
          variant="ghost"
          icon={<IconX size={16} aria-hidden="true" />}
          disabled={loading}
          onClick={onClose}
        >
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmDeletePageModal;
