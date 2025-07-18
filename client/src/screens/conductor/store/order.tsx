import { useQuery } from "@tanstack/react-query";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom-v5-compat";
import { useParams } from "react-router-dom";
import classNames from "classnames";
import api from "../../../api";

export default function OrderStatusPage() {
  const params = useParams<{ order_id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["order-status", params.order_id],
    queryFn: () => api.getCheckoutSession(params.order_id!),
    enabled: !!params.order_id,
  });
  
  const order = data?.data?.session;
  const charge = data?.data?.charge;
  const products = order?.line_items?.data || [];
  const customer = order?.customer_details || {};
  const billingAddress = customer.address || {};
  const subtotal = (order?.amount_subtotal ?? 0) / 100;
  const shipping = (order?.total_details?.amount_shipping ?? 0) / 100;
  const tax = (order?.total_details?.amount_tax ?? 0) / 100;
  const total = (order?.amount_total ?? 0) / 100;
  const paymentType = charge?.payment_method_details?.type;
  const cardDetails = charge?.payment_method_details?.card;

  return (
    <AlternateLayout>
      <main className="mx-auto max-w-2xl pb-24 pt-8 sm:px-6 sm:pt-16 lg:max-w-7xl lg:px-8">
        <div className="space-y-2 px-4 sm:flex sm:items-baseline sm:justify-between sm:space-y-0 sm:px-0">
          <div className="flex sm:items-baseline sm:space-x-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Order #{order?.id?.slice(-6) || ""}
            </h1>
          </div>
          <p className="text-sm text-gray-600">
            Order placed{" "}
            <time dateTime={order?.created ? new Date(order.created * 1000).toISOString().slice(0, 10) : ""} className="font-medium text-gray-900">
              {order?.created
                ? new Date(order.created * 1000).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : ""}
            </time>
          </p>
        </div>

        {/* Products */}
        <section aria-labelledby="products-heading" className="mt-6">
          <h2 id="products-heading" className="sr-only">
            Products purchased
          </h2>

          <div className="space-y-8">
            {products.map((item: any) => (
              <div
                key={item.id}
                className="border-b border-t border-gray-200 bg-white shadow-sm sm:rounded-lg sm:border"
              >
                <div className="px-4 py-6 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:p-8">
                  <div className="sm:flex lg:col-span-7">
                    {item.price?.product?.images?.[0] && (
                      <img
                        alt={item.price.product.name}
                        src={item.price.product.images[0]}
                        className="w-24 h-24 object-contain rounded-lg"
                      />
                    )}
                    <div className="mt-6 sm:ml-6 sm:mt-0">
                      <h3 className="text-base font-medium text-gray-900">
                        {item.price?.product?.name}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        ${(item.amount_total / 100).toFixed(2)}
                      </p>
                      <p className="mt-3 text-sm text-gray-500">
                        {item.price?.product?.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 lg:col-span-5 lg:mt-0">
                    <dl className="grid grid-cols-2 gap-x-6 text-sm">
                      <div>
                        <dt className="font-medium text-gray-900">
                          Delivery address
                        </dt>
                        <dd className="mt-3 text-gray-500">
                          <span className="block">{customer.name}</span>
                          <span className="block">{billingAddress.line1}</span>
                          <span className="block">{billingAddress.line2}</span>
                          <span className="block">
                            {billingAddress.city}, {billingAddress.state} {billingAddress.postal_code}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-900">
                          Shipping updates
                        </dt>
                        <dd className="mt-3 space-y-3 text-gray-500">
                          <p>{customer.email}</p>
                          <p>{customer.phone}</p>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <div className="border-t border-gray-200 px-4 py-6 sm:px-6 lg:p-8">
                  <h4 className="sr-only">Status</h4>
                  <p className="text-sm font-medium text-gray-900">
                    {item.price?.product?.metadata.digital === "true" ? (
                      "Digitally Delivered"
                    ) : (
                      ""
                    ) }
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Billing */}
        <section aria-labelledby="summary-heading" className="mt-16">
          <h2 id="summary-heading" className="sr-only">
            Billing Summary
          </h2>

          <div className="bg-gray-100 px-4 py-6 sm:rounded-lg sm:px-6 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:px-8 lg:py-8">
            <dl className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-2 md:gap-x-8 lg:col-span-7">
              <div>
                <dt className="font-medium text-gray-900">Billing address</dt>
                <dd className="mt-3 text-gray-500">
                  <span className="block">{customer.name}</span>
                  <span className="block">{billingAddress.line1}</span>
                  <span className="block">{billingAddress.line2}</span>
                  <span className="block">
                    {billingAddress.city}, {billingAddress.state} {billingAddress.postal_code}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-900">
                  Payment information
                </dt>
                <dd className="-ml-4 -mt-1 flex flex-wrap">
                  {paymentType === "card" && cardDetails ? (
                    <>
                      <div className="ml-4 mt-4 shrink-0">
                        <span className="text-gray-900 font-semibold">{cardDetails.brand?.toUpperCase()}</span>
                      </div>
                      <div className="ml-4 mt-4">
                        <p className="text-gray-900">Ending with {cardDetails.last4}</p>
                        <p className="text-gray-600">
                          Expires {cardDetails.exp_month?.toString().padStart(2, "0")} / {cardDetails.exp_year}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="ml-4 mt-4">
                      <p className="text-gray-900">{paymentType?.toUpperCase()}</p>
                    </div>
                  )}
                </dd>
              </div>
            </dl>

            <dl className="mt-8 divide-y divide-gray-200 text-sm lg:col-span-5 lg:mt-0">
              <div className="flex items-center justify-between pb-4">
                <dt className="text-gray-600">Subtotal</dt>
                <dd className="font-medium text-gray-900">${subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between py-4">
                <dt className="text-gray-600">Shipping</dt>
                <dd className="font-medium text-gray-900">${shipping.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between py-4">
                <dt className="text-gray-600">Tax</dt>
                <dd className="font-medium text-gray-900">${tax.toFixed(2)}</dd>
              </div>
              <div className="flex items-center justify-between pt-4">
                <dt className="font-medium text-gray-900">Order total</dt>
                <dd className="font-medium text-primary">${total.toFixed(2)}</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </AlternateLayout>
  );
}
