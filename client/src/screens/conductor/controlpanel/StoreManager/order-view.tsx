import { useParams } from "react-router-dom";
import { Badge, Breadcrumb, Button, Card, Heading, Stack } from "@libretexts/davis-react";
import type { BadgeVariant } from "@libretexts/davis-react";
import { formatPrice, truncateOrderId } from "../../../../utils/storeHelpers";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StoreOrderAutoHeal, StoreOrderWithStripeSession } from "../../../../types";
import { autoHealLabel, autoHealVariant } from "./auto-heal";
import api from "../../../../api";
import Stripe from "stripe";
import {
  IconBrandMastercard,
  IconBrandVisa,
  IconClipboardFilled,
  IconCloudComputing,
  IconExternalLink,
  IconPackage,
  IconRefreshAlert,
  IconCode,
  IconSend,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import useGlobalError from "../../../../components/error/ErrorHooks";
import ConfirmModal from "../../../../components/ConfirmModal";
import { buildLibraryPageGoURL } from "../../../../utils/projectHelpers";
import CopyButton from "../../../../components/util/CopyButton";
import { useNotifications } from "../../../../context/NotificationContext";
import ManualPrintJobModal from "../../../../components/store/ManualPrintJobModal";
import IncompletePrintJobModal from "../../../../components/store/IncompletePrintJobModal";

type PopulatedLineItem = Stripe.LineItem & {
  price:
  | (Stripe.Price & {
    product:
    | (Stripe.Product & {
      images: string[];
    })
    | null;
  })
  | null;
};

function orderStatusVariant(status?: string): BadgeVariant {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "default";
}

/**
 * Plain-language account of the one automatic recovery attempt an order gets after Lulu rejects
 * its print job.
 *
 * The support ticket is deliberately withheld while the attempt runs, so a failed order with no
 * ticket is normal for up to the attempt's deadline. Saying so here is what stops an operator
 * redoing by hand the recompile Conductor already has in flight.
 */
function autoHealSummary(autoHeal: StoreOrderAutoHeal): string {
  switch (autoHeal.state) {
    case "queued":
      return "Conductor is about to recompile this order's books and resubmit it to Lulu. No support ticket is opened unless that fails.";
    case "compiling":
      return "Conductor is recompiling this order's books in Shapeshift. It will resubmit the order to Lulu once every compile finishes.";
    case "resubmitting":
      return "Every book has been recompiled. Conductor is resubmitting the order to Lulu now.";
    case "resubmitted":
      return "Conductor recompiled this order's books and resubmitted it to Lulu. The order stays failed until Lulu confirms the new print job.";
    case "ticket_pending":
      return `Automatic recovery gave up and Conductor is opening a support ticket for this order: ${autoHeal.stoppedReason || "no reason recorded"}`;
    case "succeeded":
      return "Conductor recovered this order on its own: the books were recompiled, the order was resubmitted, and Lulu accepted the new print job.";
    case "abandoned":
      return `Automatic recovery gave up, so a support ticket was opened: ${autoHeal.stoppedReason || "no reason recorded"}`;
    case "superseded":
      return `Automatic recovery stopped because it was no longer needed: ${autoHeal.stoppedReason || "no reason recorded"}`;
    default:
      return "";
  }
}

type ModalState =
  | { type: "confirm_resubmit" }
  // `wasResubmit` is captured when the submission is fired, not read from the order: the query is
  // invalidated on success, so `luluJobID` may already have arrived by the time this renders.
  | { type: "success_resubmit"; wasResubmit: boolean }
  | { type: "incomplete_payload"; warnings: string[] }
  | { type: "manual_submit" }
  | { type: "success_manual_submit" }
  | null;

const OrderView = () => {
  const { addNotification } = useNotifications();
  const { handleGlobalError } = useGlobalError();
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const { order_id } = useParams<{ order_id: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<StoreOrderWithStripeSession>({
    queryKey: ["store-order", order_id],
    queryFn: async () => {
      const response = await api.adminGetStoreOrder(order_id);
      if (response.data.err) {
        throw new Error(response.data.errMsg || "Failed to fetch store order.");
      }
      return response.data.data;
    },
    enabled: !!order_id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const shippingAddress = useMemo(() => {
    if (!data?.stripe_session?.metadata?.shipping_address) return null;
    try {
      return JSON.parse(data.stripe_session.metadata.shipping_address);
    } catch (error) {
      console.error("Failed to parse shipping address:", error);
      return null;
    }
  }, [data]);

  const lastManualSubmission = useMemo(() => {
    const submissions = data?.manualPrintJobSubmissions;
    if (!submissions || submissions.length === 0) return null;
    return submissions[submissions.length - 1];
  }, [data]);

  const foundShippingItem = useMemo(() => {
    return data?.stripe_session?.line_items?.data.find((item) => {
      const lineItem = item as PopulatedLineItem;
      return lineItem.price?.product?.metadata?.is_shipping === "true";
    });
  }, [data]);

  /**
   * Whether this order contains anything that would be sent to Lulu. Mirrors
   * `_separateProductsByCategory` in `server/api/services/store-service.ts` -- `store_category:
   * "books"` is what ends up in the print job's line items. This is presentation only: the server
   * always re-derives the real payload from the Stripe session when a submission is made.
   */
  const hasPrintableItems = useMemo(() => {
    return !!data?.stripe_session?.line_items?.data.some((item) => {
      const lineItem = item as PopulatedLineItem;
      return lineItem.price?.product?.metadata?.store_category === "books";
    });
  }, [data]);

  const hasExistingJob = !!data?.luluJobID;

  // Falls back to `hasExistingJob` deliberately: if the Stripe session could not be fetched,
  // `hasPrintableItems` is false, and an order that already has a print job must still be
  // re-submittable.
  const canSubmitPrintJob = hasExistingJob || hasPrintableItems;

  const MetadataDisplay = ({
    metadata,
  }: {
    metadata?: Record<string, string> | null;
  }) => {
    if (!metadata) return null;

    return (
      <dl className="grid grid-cols-4 gap-y-6 gap-x-4 text-xs mt-4 w-full">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="sm:col-span-1">
            <dt className="font-medium text-gray-800">{key}</dt>
            <dd className="mt-1 text-gray-700">{value}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const resubmitPrintJobMutation = useMutation({
    // `_vars` is unused here -- it exists to carry `wasResubmit` through to `onSuccess`, which
    // cannot read it off the order (the query is invalidated before the success modal renders).
    mutationFn: async (_vars: { wasResubmit: boolean }) => {
      if (!order_id)
        throw new Error("Order ID is required to submit a print job.");
      const response = await api.adminResubmitPrintJob(order_id);
      if (response.data.err) {
        // An incomplete payload is an expected, recoverable outcome rather than a fault: nothing
        // was sent to Lulu, and the operator is offered the manual editor. Everything else is a
        // real error and goes to the global handler.
        if (response.data.code === "INCOMPLETE_PAYLOAD") {
          return {
            kind: "incomplete" as const,
            warnings: response.data.warnings ?? [],
          };
        }
        throw new Error(response.data.errMsg || "Failed to submit print job.");
      }
      return { kind: "submitted" as const };
    },
    onSuccess: (result, variables) => {
      if (result.kind === "incomplete") {
        setActiveModal({
          type: "incomplete_payload",
          warnings: result.warnings,
        });
        return;
      }
      queryClient.invalidateQueries(["store-order", order_id]);
      setActiveModal({
        type: "success_resubmit",
        wasResubmit: variables.wasResubmit,
      });
    },
    onError(error) {
      handleGlobalError(error);
    },
  });

  function initResubmitPrintJob() {
    if (!canSubmitPrintJob) {
      handleGlobalError(
        new Error("This order has no items that can be sent to Lulu.")
      );
      return;
    }
    setActiveModal({ type: "confirm_resubmit" });
  }

  return (
    <div className="min-h-screen px-8 pt-8 pb-8">
      <ConfirmModal
        text={
          hasExistingJob
            ? "Are you sure you want to re-submit this print job?"
            : "Are you sure you want to submit this order to Lulu for printing? The order details recorded at checkout will be sent as-is."
        }
        onConfirm={() => {
          resubmitPrintJobMutation.mutate({ wasResubmit: hasExistingJob });
          setActiveModal(null);
        }}
        onCancel={() => setActiveModal(null)}
        open={activeModal?.type === "confirm_resubmit"}
      />
      <ConfirmModal
        text={
          activeModal?.type === "success_resubmit" && !activeModal.wasResubmit
            ? "Print job submitted to Lulu successfully. It may take some time for the status to update."
            : "Print job resubmitted successfully. It may take some time for the status to update."
        }
        onConfirm={() => setActiveModal(null)}
        onCancel={() => setActiveModal(null)}
        confirmText="OK"
        open={activeModal?.type === "success_resubmit"}
      />
      <IncompletePrintJobModal
        show={activeModal?.type === "incomplete_payload"}
        warnings={
          activeModal?.type === "incomplete_payload" ? activeModal.warnings : []
        }
        onClose={() => setActiveModal(null)}
        onFixManually={() => setActiveModal({ type: "manual_submit" })}
      />
      {order_id && (
        <ManualPrintJobModal
          show={activeModal?.type === "manual_submit"}
          orderID={order_id}
          onClose={() => setActiveModal(null)}
          onSuccess={() => setActiveModal({ type: "success_manual_submit" })}
        />
      )}
      <ConfirmModal
        text="Print job submitted to Lulu successfully. It may take some time for the status to update."
        onConfirm={() => setActiveModal(null)}
        onCancel={() => setActiveModal(null)}
        confirmText="OK"
        open={activeModal?.type === "success_manual_submit"}
      />
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>LibreTexts Store Management</Heading>
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/store">
            Store Management
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>
            {truncateOrderId(order_id)}
          </Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center">
            <span>{order_id}</span>
            <CopyButton val={order_id}>
              {({ copied, copy }) => (
                <IconClipboardFilled
                  className="cursor-pointer !ml-1.5 w-5 h-5 text-primary"
                  onClick={() => {
                    copy();
                    addNotification({
                      message: "Order ID copied to clipboard",
                      type: "success",
                      duration: 2000,
                    });
                  }}
                />
              )}
            </CopyButton>
          </div>
          <div className="flex items-center text-sm gap-1">
            <span className="font-medium text-gray-700">Status:</span>
            <Badge
              label={data?.status || "Unknown"}
              variant={orderStatusVariant(data?.status)}
              size="sm"
              className="capitalize"
            />
            <div className="mx-2 text-gray-400">•</div>
            <div className="font-medium text-gray-900">
              Ordered{" "}
              {data?.createdAt
                ? new Date(data.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })
                : ""}
            </div>
            <div>
              {data?.stripe_charge?.receipt_url && (
                <>
                  <div className="mx-2 text-gray-400">•</div>
                  <a
                    href={data.stripe_charge.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:text-primary-hover"
                  >
                    View receipt
                    <span aria-hidden="true"> &rarr;</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          <section aria-labelledby="products-heading">
            <h2 id="products-heading" className="sr-only">
              Products purchased
            </h2>

            <div className="space-y-6">
              {data?.stripe_session?.line_items?.data.map((item) => {
                const lineItem = item as PopulatedLineItem;
                const bookID =
                  lineItem.price?.product?.metadata?.["book_id"] || "";
                const digitalProduct =
                  lineItem.price?.product?.metadata?.digital === "true";
                return (
                  <Card key={lineItem.id}>
                    <Card.Body>
                      <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-col">
                          <div className="sm:flex lg:col-span-7">
                            {lineItem.price?.product?.images &&
                              lineItem.price?.product?.images.length > 0 ? (
                              <img
                                alt={
                                  lineItem.price?.product?.name || "Product Image"
                                }
                                src={lineItem.price?.product?.images[0] || ""}
                                className="aspect-square w-full shrink-0 rounded-lg object-contain sm:size-40"
                              />
                            ) : (
                              <IconPackage className="size-40 text-gray-400" />
                            )}

                            <div className="mt-6 sm:ml-6 sm:mt-0">
                              <h3 className="text-base font-medium text-gray-900">
                                <a
                                  href={`https://commons.libretexts.org/store/product/${bookID ? bookID : lineItem.price?.product?.id
                                    }`}
                                >
                                  {lineItem.price?.product?.name}{" "}
                                  {lineItem.price?.nickname ? (
                                    <span className="text-gray-500">
                                      ({lineItem.price?.nickname})
                                    </span>
                                  ) : null}
                                </a>
                              </h3>
                              <p className="mt-2 text-sm font-medium text-gray-900">
                                {formatPrice(lineItem.price?.unit_amount, true)}
                              </p>
                              <p className="mt-3 text-sm text-gray-500">
                                {lineItem.description}
                              </p>
                              <MetadataDisplay
                                metadata={lineItem.price?.product?.metadata}
                              />
                              <div className="mt-4">
                                {lineItem.price?.product?.metadata["book_id"] && (
                                  <div className="flex flex-row space-x-2">
                                    <a
                                      href={buildLibraryPageGoURL(
                                        bookID.split("-")[0] || "unknown",
                                        bookID.split("-")[1] || "unknown"
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Button
                                        variant="primary"
                                        icon={<IconExternalLink size={16} />}
                                        size="sm"
                                      >
                                        View Book in Library
                                      </Button>
                                    </a>
                                    <a
                                      href={`https://commons.libretexts.org/store/product/${bookID}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Button
                                        variant="primary"
                                        icon={<IconExternalLink size={16} />}
                                        size="sm"
                                      >
                                        View Book in Store
                                      </Button>
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-6 flex flex-col justify-end items-end self-start text-sm text-gray-500 sm:mt-0">
                          <span className="font-medium text-gray-900">
                            Quantity: {lineItem.quantity}
                          </span>
                          {digitalProduct ? (
                            <span className="mt-2">
                              <IconCloudComputing className="inline-block h-5 w-5 text-gray-500 mr-1" />
                              Digital Product
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
          </section>

          {data && (
            <section aria-labelledby="lulu-heading" className="mt-12">
              <h2
                id="lulu-heading"
                className="font-semibold text-lg text-gray-900 ml-1 mb-2"
              >
                Print Job
              </h2>
              <Card>
                <Card.Body className="text-sm flex flex-row justify-between">
                  <div className="flex flex-col">
                    {data.luluJobID ? (
                      <>
                        <div>
                          <dt className="font-medium text-gray-900">
                            Lulu Job ID
                          </dt>
                          <dd className="mt-1 text-gray-500">
                            <a
                              href={`https://developers.lulu.com/print-jobs/detail/${data.luluJobID}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              {data.luluJobID}
                            </a>
                          </dd>
                        </div>
                        <div className="mt-4">
                          <dt className="font-medium text-gray-900">
                            Last Lulu Job Status
                          </dt>
                          <dd className="mt-1 text-gray-500">
                            <span className="block">{data.luluJobStatus}</span>
                          </dd>
                        </div>
                        <div className="mt-4">
                          <dt className="font-medium text-gray-900">
                            Last Lulu Job Status Update
                          </dt>
                          <dd className="mt-1 text-gray-500">
                            <span className="block">
                              {data.luluJobStatusMessage || "No status message"}
                            </span>
                          </dd>
                        </div>
                      </>
                    ) : (
                      <div>
                        <dt className="font-medium text-gray-900">
                          {hasPrintableItems
                            ? "No Lulu Print Job"
                            : "No Printed Items"}
                        </dt>
                        <dd className="mt-1 text-gray-500">
                          <span className="block">
                            {hasPrintableItems
                              ? "No print job was ever created with Lulu for this order. Use Submit Print Job to send the recorded order details to Lulu, or Submit Order Details Manually to correct them first."
                              : "This order contains no printed books, so there is nothing to send to Lulu."}
                          </span>
                          {data.error && (
                            <span className="block mt-2">
                              Recorded error: {data.error}
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    {data.autoHeal && (
                      <div className="mt-4">
                        <dt className="font-medium text-gray-900">
                          Automatic Recovery
                        </dt>
                        <dd className="mt-1 text-gray-500">
                          <Badge
                            label={autoHealLabel(data.autoHeal.state) ?? data.autoHeal.state}
                            variant={autoHealVariant(data.autoHeal.state)}
                            size="sm"
                          />
                          <span className="block mt-2">
                            {autoHealSummary(data.autoHeal)}
                          </span>
                          <span className="block mt-2">
                            Started{" "}
                            {new Date(data.autoHeal.startedAt).toLocaleString()}
                            {data.autoHeal.finishedAt
                              ? `, finished ${new Date(data.autoHeal.finishedAt).toLocaleString()}`
                              : `, gives up ${new Date(
                                  data.autoHeal.state === "resubmitted" &&
                                  data.autoHeal.confirmationDeadlineAt
                                    ? data.autoHeal.confirmationDeadlineAt
                                    : data.autoHeal.deadlineAt
                                ).toLocaleString()}`}
                          </span>
                          {data.autoHeal.books.length > 0 && (
                            <ul className="mt-2 list-disc list-inside">
                              {data.autoHeal.books.map((book) => (
                                <li key={book.bookID}>
                                  {book.bookID}: recompile {book.status}
                                  {book.error ? ` (${book.error})` : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                        </dd>
                      </div>
                    )}
                    {lastManualSubmission && (
                      <div className="mt-4">
                        <dt className="font-medium text-gray-900">
                          Manual Submissions
                        </dt>
                        <dd className="mt-1 text-gray-500">
                          <span className="block">
                            {data?.manualPrintJobSubmissions?.length} total. Last:{" "}
                            {new Date(
                              lastManualSubmission.submittedAt
                            ).toLocaleString()}{" "}
                            by {lastManualSubmission.submittedBy} &mdash;{" "}
                            {lastManualSubmission.success
                              ? `accepted (job ${lastManualSubmission.luluJobID})`
                              : `failed: ${lastManualSubmission.error || "unknown error"}`}
                          </span>
                        </dd>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row items-start gap-x-2">
                    <Button
                      variant="outline"
                      icon={<IconCode size={16} />}
                      onClick={() => setActiveModal({ type: "manual_submit" })}
                      disabled={!order_id || !canSubmitPrintJob}
                    >
                      Submit Order Details Manually
                    </Button>
                    <Button
                      variant="secondary"
                      icon={
                        hasExistingJob ? (
                          <IconRefreshAlert size={16} />
                        ) : (
                          <IconSend size={16} />
                        )
                      }
                      onClick={initResubmitPrintJob}
                      disabled={
                        resubmitPrintJobMutation.isLoading || !canSubmitPrintJob
                      }
                      loading={resubmitPrintJobMutation.isLoading}
                    >
                      {hasExistingJob
                        ? "Re-Submit Print Job"
                        : "Submit Print Job"}
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </section>
          )}

          <section aria-labelledby="summary-heading" className="mt-12">
            <h2
              id="summary-heading"
              className="font-semibold text-lg text-gray-900 ml-1 mb-2"
            >
              Summary
            </h2>

            <Card>
              <Card.Body className="lg:grid lg:grid-cols-12 lg:gap-x-8">
                <dl className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 md:gap-x-8 lg:col-span-5 lg:pl-8">
                  <div>
                    <dt className="font-medium text-gray-900">Shipping address</dt>
                    <dd className="mt-3 text-gray-500">
                      <span className="block">
                        {shippingAddress?.first_name} {shippingAddress?.last_name}{" "}
                        {shippingAddress?.company
                          ? `(${shippingAddress?.company})`
                          : null}
                      </span>
                      <span className="block">
                        {shippingAddress?.address_line_1}
                      </span>
                      <span className="block">
                        {shippingAddress?.address_line_2}
                      </span>
                      <span className="block">
                        {shippingAddress?.city}, {shippingAddress?.state}{" "}
                        {shippingAddress?.postal_code}{" "}
                        {shippingAddress?.country &&
                          `(${shippingAddress?.country})`}
                      </span>
                      <span className="block">
                        {shippingAddress?.email || "No email provided"}
                      </span>
                      <span className="block">
                        {shippingAddress?.phone || "No phone number provided"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-900">
                      Payment information
                    </dt>
                    <dd className="mt-3 flex">
                      <div>
                        {data?.stripe_charge?.payment_method_details?.card
                          ?.brand === "visa" && (
                            <IconBrandVisa className="h-6 w-6 text-gray-900" />
                          )}
                        {data?.stripe_charge?.payment_method_details?.card
                          ?.brand === "mastercard" && (
                            <IconBrandMastercard className="h-6 w-6 text-gray-900" />
                          )}
                        <p className="sr-only">
                          {
                            data?.stripe_charge?.payment_method_details?.card
                              ?.brand
                          }
                        </p>
                      </div>
                      <div className="ml-4">
                        <p className="text-gray-900">
                          Ending with{" "}
                          {
                            data?.stripe_charge?.payment_method_details?.card
                              ?.last4
                          }
                        </p>
                        <p className="text-gray-600">
                          Expires{" "}
                          {
                            data?.stripe_charge?.payment_method_details?.card
                              ?.exp_month
                          }{" "}
                          /{" "}
                          {
                            data?.stripe_charge?.payment_method_details?.card
                              ?.exp_year
                          }
                        </p>
                        <p className="text-gray-600">
                          Billing ZIP:{" "}
                          {data?.stripe_charge?.billing_details?.address
                            ?.postal_code || "Unknown"}
                        </p>
                      </div>
                    </dd>
                  </div>
                </dl>

                <dl className="mt-8 divide-y divide-gray-200 text-sm lg:col-span-7 lg:mt-0 lg:pr-8">
                  <div className="flex items-center justify-between pb-4">
                    <dt className="text-gray-600">Subtotal</dt>
                    <dd className="font-medium text-gray-900">
                      {formatPrice(data?.stripe_session?.amount_subtotal, true)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-4">
                    <dt className="text-gray-600">Shipping</dt>
                    <dd className="font-medium text-gray-900">
                      {foundShippingItem && foundShippingItem.amount_total
                        ? formatPrice(foundShippingItem.amount_total, true)
                        : "$0.00"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-4">
                    <dt className="text-gray-600">Tax</dt>
                    <dd className="font-medium text-gray-900">
                      {data?.stripe_session?.total_details?.amount_tax
                        ? formatPrice(
                          data?.stripe_session?.total_details?.amount_tax,
                          true
                        )
                        : "$0.00"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-4">
                    <dt className="text-gray-600">Discount</dt>
                    <dd className="font-medium text-gray-900">
                      {data?.stripe_session?.total_details?.amount_discount
                        ? `(${formatPrice(
                          data?.stripe_session?.total_details?.amount_discount,
                          true
                        )})`
                        : "$0.00"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between pt-4">
                    <dt className="font-medium text-gray-900">Order total</dt>
                    <dd className="font-semibold text-primary">
                      {data?.stripe_session?.amount_total
                        ? formatPrice(data?.stripe_session?.amount_total, true)
                        : "$0.00"}
                    </dd>
                  </div>
                </dl>
              </Card.Body>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
};

export default OrderView;
