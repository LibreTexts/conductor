import React from "react";
import { StoreOrderShippingItemData } from "../../types";
import { IconCheck, IconSettings, IconTruck, IconHome } from "@tabler/icons-react";

interface ShippingTimelineProps {
  itemData?: StoreOrderShippingItemData | null;
  estimatedShippingDates?: { arrival_min: string; arrival_max: string; dispatch_min: string; dispatch_max: string } | null;
  orderDate?: number; // Stripe session `created` unix timestamp
}

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateString));

const formatDateRange = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`;

export default function ShippingTimeline({ itemData, estimatedShippingDates, orderDate }: ShippingTimelineProps) {
  const statusOrder = ["ORDER_PLACED", "IN_PRODUCTION", "SHIPPED", "DELIVERED"] as const;
  const currentStatusIndex = itemData ? statusOrder.indexOf(itemData.shippingStatus) : 0;

  const orderDateFormatted = orderDate
    ? new Date(orderDate * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const timelineSteps = [
    {
      name: "Order Placed",
      icon: IconCheck,
      date: orderDateFormatted,
      statusIndex: 0,
    },
    {
      name: "In Production",
      icon: IconSettings,
      date: "",
      statusIndex: 1,
    },
    {
      name: "Shipped",
      icon: IconTruck,
      date: estimatedShippingDates
        ? formatDateRange(estimatedShippingDates.dispatch_min, estimatedShippingDates.dispatch_max)
        : "",
      statusIndex: 2,
    },
    {
      name: "Estimated Arrival",
      icon: IconHome,
      date: estimatedShippingDates
        ? formatDateRange(estimatedShippingDates.arrival_min, estimatedShippingDates.arrival_max)
        : "",
      statusIndex: 3,
    },
  ];

  return (
    <div className="mt-6">
      <div className="flex items-start">
        {timelineSteps.map((step, stepIdx) => {
          const completed = step.statusIndex <= currentStatusIndex;
          const active = step.statusIndex === currentStatusIndex;
          return (
            <React.Fragment key={step.name}>
              <div className="flex flex-col items-center" style={{ width: 80 }}>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                    completed ? "border-primary bg-primary" : "border-gray-300 bg-white"
                  }`}
                >
                  <step.icon
                    className={`h-6 w-6 ${completed ? "text-white" : "text-gray-400"}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-3 text-center">
                  <p className={`text-sm font-medium ${active ? "text-primary" : completed ? "text-gray-700" : "text-gray-500"}`}>
                    {step.name}
                  </p>
                  {step.date && (
                    <p className="mt-1 text-xs text-gray-500 !text-center">{step.date}</p>
                  )}
                </div>
              </div>
              {stepIdx < timelineSteps.length - 1 && (
                <div className="flex flex-1 items-center" style={{ height: 40 }}>
                  <div
                    className={`h-0.5 w-full ${step.statusIndex < currentStatusIndex ? "bg-primary" : "bg-gray-300"}`}
                    aria-hidden="true"
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {itemData?.trackingID && (
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          {itemData.carrierName && (
            <span className="text-gray-600">
              <span className="font-medium text-gray-900">Carrier:</span> {itemData.carrierName}
            </span>
          )}
          <span className="text-gray-600">
            <span className="font-medium text-gray-900">Tracking ID:</span> {itemData.trackingID}
          </span>
          {itemData.trackingURLs.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">
              Track shipment{itemData.trackingURLs.length > 1 ? ` (${i + 1})` : ""}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
