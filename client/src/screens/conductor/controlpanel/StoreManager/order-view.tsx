import { Link, useParams } from "react-router-dom";
import { Header, Segment, Grid, Breadcrumb } from "semantic-ui-react";
import { formatPrice, truncateOrderId } from "../../../../utils/storeHelpers";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StoreOrderWithStripeSession } from "../../../../types";
import api from "../../../../api";
import Stripe from "stripe";
import {
  IconBrandMastercard,
  IconBrandVisa,
  IconCloudComputing,
  IconPackage,
} from "@tabler/icons-react";
import { useMemo } from "react";
import useGlobalError from "../../../../components/error/ErrorHooks";
import Button from "../../../../components/NextGenComponents/Button";
import { useModals } from "../../../../context/ModalContext";
import ConfirmModal from "../../../../components/ConfirmModal";

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

const OrderView = () => {
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();
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
    staleTime: 1000 * 60 * 5, // 5 minutes
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

  const foundShippingItem = useMemo(() => {
    return data?.stripe_session?.line_items?.data.find((item) => {
      const lineItem = item as PopulatedLineItem;
      return lineItem.price?.product?.metadata?.is_shipping === "true";
    });
  }, [data]);

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
    mutationFn: async () => {
      if (!order_id)
        throw new Error("Order ID is required to resubmit print job.");
      const response = await api.adminResubmitPrintJob(order_id);
      if (response.data.err) {
        throw new Error(
          response.data.errMsg || "Failed to resubmit print job."
        );
      }
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["store-order", order_id]);
      openModal(
        <ConfirmModal
          text="Print job resubmitted successfully. It may take some time for the status to update."
          onConfirm={closeAllModals}
          onCancel={closeAllModals}
          confirmText="OK"
        />
      );
    },
    onError(error, variables, context) {
      handleGlobalError(error);
    },
  });

  function initResubmitPrintJob() {
    if (!data?.luluJobID) {
      handleGlobalError(new Error("No Lulu job ID found for this order."));
      return;
    }

    openModal(
      <ConfirmModal
        text="Are you sure you want to re-submit this print job?"
        onConfirm={() => {
          resubmitPrintJobMutation.mutate();
          closeAllModals();
        }}
        onCancel={closeAllModals}
      />
    );
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            LibreTexts Store Management
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment className="flex items-center justify-between">
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section as={Link} to="/controlpanel/store">
                  Store Management
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  {truncateOrderId(order_id)}
                </Breadcrumb.Section>
              </Breadcrumb>
              <div className="flex items-center">
                <div className="font-medium text-gray-900">
                  Ordered{" "}
                  {data?.createdAt
                    ? new Date(data.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    : ""}
                </div>{" "}
                {/* show dot seperator here*/}
                <div className="mx-2 text-gray-400">•</div>
                <div className="">
                  {data?.stripe_charge?.receipt_url && (
                    <a
                      href={data.stripe_charge.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:text-primary-hover"
                    >
                      View receipt
                      <span aria-hidden="true"> &rarr;</span>
                    </a>
                  )}
                </div>
              </div>
            </Segment>
            <Segment>
              <section aria-labelledby="products-heading" className="mt-6">
                <h2 id="products-heading" className="sr-only">
                  Products purchased
                </h2>

                <div className="space-y-6">
                  {data?.stripe_session?.line_items?.data.map((item) => {
                    const lineItem = item as PopulatedLineItem;
                    const digitalProduct =
                      lineItem.price?.product?.metadata?.digital === "true";
                    return (
                      <div
                        key={lineItem.id}
                        className="border-b border-t border-gray-200 bg-white shadow-sm sm:rounded-lg sm:border"
                      >
                        <div className="flex flex-row items-center justify-between px-4 py-6 sm:px-6">
                          <div className="flex flex-col">
                            <div className="sm:flex lg:col-span-7">
                              {lineItem.price?.product?.images &&
                              lineItem.price?.product?.images.length > 0 ? (
                                <img
                                  alt={
                                    lineItem.price?.product?.name ||
                                    "Product Image"
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
                                    href={`https://commons.libretexts.org/store/products/${lineItem.price?.product?.id}`}
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
                                  {formatPrice(
                                    lineItem.price?.unit_amount,
                                    true
                                  )}
                                </p>
                                <p className="mt-3 text-sm text-gray-500">
                                  {lineItem.description}
                                </p>
                                <MetadataDisplay
                                  metadata={lineItem.price?.product?.metadata}
                                />
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
                      </div>
                    );
                  })}
                </div>
              </section>
              {data?.luluJobID && (
                <section aria-labelledby="lulu-heading" className="mt-12">
                  <h2
                    id="lulu-heading"
                    className="font-semibold text-lg text-gray-900 ml-1 mb-2"
                  >
                    Lulu Job Information
                  </h2>
                  <div className="rounded-lg bg-gray-100 p-8 text-sm shadow-sm border flex flex-row justify-between">
                    <div className="flex flex-col">
                      <div>
                        <dt className="font-medium text-gray-900">
                          Lulu Job ID
                        </dt>
                        <dd className="mt-1 text-gray-500">
                          <a
                            href={`https://developers.lulu.com/print-jobs/detail/${data?.luluJobID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            {data?.luluJobID}
                          </a>
                        </dd>
                      </div>
                      <div className="mt-4">
                        <dt className="font-medium text-gray-900">
                          Last Lulu Job Status
                        </dt>
                        <dd className="mt-1 text-gray-500">
                          <span className="block">{data?.luluJobStatus}</span>
                        </dd>
                      </div>
                      <div className="mt-4">
                        <dt className="font-medium text-gray-900">
                          Last Lulu Job Status Update
                        </dt>
                        <dd className="mt-1 text-gray-500">
                          <span className="block">
                            {data?.luluJobStatusMessage || "No status message"}
                          </span>
                        </dd>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <Button
                        icon="IconRefreshAlert"
                        onClick={initResubmitPrintJob}
                        disabled={
                          resubmitPrintJobMutation.isLoading || !data?.luluJobID
                        }
                      >
                        Re-Submit Print Job
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              <section aria-labelledby="summary-heading" className="mt-12">
                <h2
                  id="summary-heading"
                  className="font-semibold text-lg text-gray-900 ml-1 mb-2"
                >
                  Summary
                </h2>

                <div className="rounded-lg bg-gray-100 px-6 py-6 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:px-0 lg:py-8">
                  <dl className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 md:gap-x-8 lg:col-span-5 lg:pl-8">
                    <div>
                      <dt className="font-medium text-gray-900">
                        Shipping address
                      </dt>
                      <dd className="mt-3 text-gray-500">
                        <span className="block">
                          {shippingAddress?.first_name}{" "}
                          {shippingAddress?.last_name}{" "}
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
                          {shippingAddress?.country &&
                            `(${shippingAddress?.country})`}
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
                        {formatPrice(
                          data?.stripe_session?.amount_subtotal,
                          true
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <dt className="text-gray-600">Shipping</dt>
                      <dd className="font-medium text-gray-900">
                        {foundShippingItem
                          ? formatPrice(foundShippingItem.amount_total, true)
                          : "Free"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <dt className="text-gray-600">Tax</dt>
                      <dd className="font-medium text-gray-900">
                        {formatPrice(
                          data?.stripe_session?.total_details?.amount_tax,
                          true
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between pt-4">
                      <dt className="font-medium text-gray-900">Order total</dt>
                      <dd className="font-semibold text-primary">
                        {formatPrice(data?.stripe_session?.amount_total, true)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default OrderView;
