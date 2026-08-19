import { Suspense, lazy, useEffect, useId, useMemo, useState } from "react";
import { Alert, Button, Modal } from "@libretexts/davis-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconClipboardFilled, IconPlus, IconSend } from "@tabler/icons-react";
import api from "../../api";
import {
  ManualPrintJobPayload,
  ManualPrintJobPayloadResponse,
} from "../../types";
import useGlobalError from "../error/ErrorHooks";
import LoadingSpinner from "../LoadingSpinner";
import CopyButton from "../util/CopyButton";
import { useNotifications } from "../../context/NotificationContext";

// CodeMirror is a sizeable dependency and this modal is only reachable from a superadmin
// screen, so keep it out of the main bundle.
const JsonEditor = lazy(() => import("./JsonEditor"));

/**
 * A blank line item in the exact shape `LuluPrintJobLineItem` requires, so an operator adding
 * a book by hand does not have to remember the structure. Operator-supplied values are left
 * empty on purpose: the server schema rejects them, which is a clearer signal than a plausible
 * placeholder that validates and then fails at Lulu. `pod_package_id` carries the black &
 * white, perfect-bound default produced by `LuluService.getPodPackageID`.
 */
function createLineItemSkeleton() {
  return {
    external_id: "",
    title: "",
    quantity: 1,
    printable_normalization: {
      cover: { source_url: "" },
      interior: { source_url: "" },
      pod_package_id: "0850X1100.BW.STD.PB.060UW444.MXX",
    },
  };
}

interface ManualPrintJobModalProps {
  show: boolean;
  orderID: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Lets a superadmin review, hand-edit, and submit the Lulu print job payload for an order.
 *
 * This exists because plain "Re-Submit Print Job" rebuilds the identical payload from the
 * Stripe checkout session, which is useless when Lulu rejected the job *because* of that
 * payload (bad address, wrong pod_package_id, missing book assets). `external_id` is shown
 * read-only and is re-applied server-side: it is the Stripe Checkout Session ID, and it is
 * what lets Lulu's status webhook reattach the resulting job to this order.
 */
const ManualPrintJobModal: React.FC<ManualPrintJobModalProps> = ({
  show,
  orderID,
  onClose,
  onSuccess,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const editorLabelID = useId();
  const parseErrorID = useId();
  const appendHintID = useId();

  const [draft, setDraft] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } =
    useQuery<ManualPrintJobPayloadResponse>({
      queryKey: ["store-order-print-job-payload", orderID],
      queryFn: async () => {
        const response = await api.adminGetPrintJobPayload(orderID);
        if (response.data.err) {
          throw new Error(
            response.data.errMsg || "Failed to build print job payload."
          );
        }
        return response.data.data;
      },
      enabled: !!show && !!orderID,
      // Always re-derive from Stripe when the modal is opened -- a stale payload here would be
      // silently submitted to Lulu.
      staleTime: 0,
      cacheTime: 0,
      refetchOnWindowFocus: false,
      onError: (error) => handleGlobalError(error),
    });

  // The editable document excludes external_id; it is displayed separately and re-applied
  // server-side so it can never be edited away.
  const generatedDraft = useMemo(() => {
    if (!data?.params) return "";
    const { external_id, ...editable } = data.params;
    return JSON.stringify(editable, null, 2);
  }, [data]);

  useEffect(() => {
    if (generatedDraft) {
      setDraft(generatedDraft);
      setParseError(null);
    }
  }, [generatedDraft]);

  useEffect(() => {
    if (!show) {
      setDraft("");
      setParseError(null);
    }
  }, [show]);

  function handleDraftChange(value: string) {
    setDraft(value);
    try {
      JSON.parse(value);
      setParseError(null);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON.");
    }
  }

  /**
   * Appends a blank line item to the draft's `line_items`, creating the array if the generated
   * payload had none (the common case when nothing resolved from the Stripe session).
   */
  function handleAppendLineItem() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft || "{}");
    } catch {
      // Unreachable while the button is disabled on a parse error, but never silently no-op.
      handleGlobalError(
        new Error("The payload must be valid JSON before a line item can be appended.")
      );
      return;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      handleGlobalError(
        new Error("The payload must be a JSON object before a line item can be appended.")
      );
      return;
    }

    const current = parsed as Record<string, unknown>;
    const existing = Array.isArray(current.line_items) ? current.line_items : [];
    const next = {
      ...current,
      line_items: [...existing, createLineItemSkeleton()],
    };

    setDraft(JSON.stringify(next, null, 2));
    setParseError(null);
    addNotification({
      message: "Blank line item appended. Fill in the book ID, title, and source URLs.",
      type: "success",
      duration: 4000,
    });
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = JSON.parse(draft) as ManualPrintJobPayload;
      const response = await api.adminSubmitManualPrintJob(orderID, payload);
      if (response.data.err) {
        throw new Error(
          response.data.errMsg || "Failed to submit print job to Lulu."
        );
      }
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["store-order", orderID]);
      onSuccess();
    },
    onError: (error) => handleGlobalError(error),
  });

  const isBusy = isLoading || isRefetching;
  const canSubmit = !isBusy && !parseError && !!draft && !submitMutation.isLoading;

  return (
    <Modal open={show} onClose={onClose} size="xl">
      <Modal.Header>
        <Modal.Title>Submit Order Details Manually</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="warning" message="Stop! You shouldn't use this unless you know what you're doing. This is for rare cases where the order details need to be manually corrected before submission to Lulu." />
        <div className="my-4 rounded-md bg-gray-50 border border-gray-200 p-3">
          <div className="text-xs font-medium text-gray-800">
            external_id (read-only)
          </div>
          <div className="flex items-center mt-1">
            <code className="text-xs text-gray-900 break-all">
              {data?.params?.external_id || orderID}
            </code>
            <CopyButton val={data?.params?.external_id || orderID}>
              {({ copy }) => (
                <button
                  type="button"
                  className="ml-1.5 text-primary"
                  aria-label="Copy external ID to clipboard"
                  onClick={() => {
                    copy();
                    addNotification({
                      message: "External ID copied to clipboard",
                      type: "success",
                      duration: 2000,
                    });
                  }}
                >
                  <IconClipboardFilled className="w-4 h-4" />
                </button>
              )}
            </CopyButton>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            This is the Stripe Checkout Session ID. It is set by the server and
            cannot be changed &mdash; it is what lets Lulu&apos;s status webhook
            reattach the new print job to this order.
          </p>
        </div>

        {data?.warnings && data.warnings.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {data.warnings.map((warning, idx) => (
              <Alert
                key={idx}
                variant="warning"
                title={idx === 0 ? "This payload is incomplete" : undefined}
                message={warning}
              />
            ))}
          </div>
        )}

        <div className="flex flex-row items-end justify-between mb-1">
          <label
            id={editorLabelID}
            className="block text-sm font-medium text-gray-900"
          >
            Lulu print job payload (JSON)
          </label>
          <Button
            variant="outline"
            size="sm"
            icon={<IconPlus size={16} />}
            onClick={handleAppendLineItem}
            disabled={isBusy || !!parseError || submitMutation.isLoading}
            aria-describedby={appendHintID}
          >
            Append line item
          </Button>
        </div>
        <p id={appendHintID} className="mb-1 text-xs text-gray-600">
          Cover and interior <code>source_url</code>s should be{" "}
          <code>
            downloads.libretexts.org/api/v1/download/&lt;bookID&gt;/&lt;format&gt;
          </code>{" "}
          links. Lulu follows the redirect to storage when the print job is
          created, so paste the stable downloads URL rather than a resolved{" "}
          <code>storage.downloads.libretexts.org</code> link &mdash; a resolved
          link pins one compiled version of the book.
        </p>
        {isBusy ? (
          <LoadingSpinner />
        ) : (
          <Suspense fallback={<LoadingSpinner />}>
            <JsonEditor
              value={draft}
              onChange={handleDraftChange}
              labelledBy={editorLabelID}
              describedBy={parseError ? parseErrorID : undefined}
            />
          </Suspense>
        )}

        <div id={parseErrorID} role="alert" aria-live="polite">
          {parseError && (
            <p className="mt-2 text-sm text-red-700">
              Invalid JSON &mdash; submission is disabled until this is fixed:{" "}
              {parseError}
            </p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isBusy || submitMutation.isLoading}
        >
          Reset to generated
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={submitMutation.isLoading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<IconSend size={16} />}
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit}
          loading={submitMutation.isLoading}
        >
          Submit to Lulu
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ManualPrintJobModal;
