import React from "react";
import { StoreOrderShippingItemData } from "../../types";
import { IconCheck, IconSettings, IconTruck, IconHome } from "@tabler/icons-react";

type ShippingStepKey = "ORDER_PLACED" | "IN_PRODUCTION" | "SHIPPED" | "DELIVERED";
type ShippingStepVisualState = "completed" | "in_progress" | "upcoming";

interface ShippingTimelineProps {
  itemData?: StoreOrderShippingItemData | null;
  estimatedShippingDates?: { production_min?: string; production_max?: string; arrival_min: string; arrival_max: string; dispatch_min: string; dispatch_max: string } | null;
  orderDate?: number; // Stripe session `created` unix timestamp
  isEstimatePreview?: boolean;
  stepStateOverrides?: Partial<Record<ShippingStepKey, ShippingStepVisualState>>;
}

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: undefined }).format(new Date(dateString));

const formatDateRange = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`;

export default function ShippingTimeline({ itemData, estimatedShippingDates, orderDate, isEstimatePreview, stepStateOverrides }: ShippingTimelineProps) {
  const statusOrder = ["ORDER_PLACED", "IN_PRODUCTION", "SHIPPED", "DELIVERED"] as const;
  const currentStatusIndex = itemData ? statusOrder.indexOf(itemData.shippingStatus) : 0;

  const orderDateFormatted = orderDate
    ? new Date(orderDate * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  const timelineSteps = [
    {
      key: "ORDER_PLACED" as const,
      name: "Order Placed",
      icon: IconCheck,
      date: orderDateFormatted,
      statusIndex: 0,
    },
    {
      key: "IN_PRODUCTION" as const,
      name: "In Production",
      icon: IconSettings,
      date: estimatedShippingDates?.production_min && estimatedShippingDates?.production_max
        ? formatDateRange(estimatedShippingDates.production_min, estimatedShippingDates.production_max)
        : "",
      statusIndex: 1,
    },
    {
      key: "SHIPPED" as const,
      name: "Shipped",
      icon: IconTruck,
      date: estimatedShippingDates?.dispatch_min && estimatedShippingDates?.dispatch_max
        ? formatDateRange(estimatedShippingDates.dispatch_min, estimatedShippingDates.dispatch_max)
        : "",
      statusIndex: 2,
    },
    {
      key: "DELIVERED" as const,
      name: "Estimated Arrival",
      icon: IconHome,
      date: estimatedShippingDates?.arrival_min && estimatedShippingDates?.arrival_max
        ? formatDateRange(estimatedShippingDates.arrival_min, estimatedShippingDates.arrival_max)
        : "",
      statusIndex: 3,
    },
  ];

  const previewDefaults: Partial<Record<ShippingStepKey, ShippingStepVisualState>> | undefined = isEstimatePreview
    ? {
        ORDER_PLACED: "in_progress",
        IN_PRODUCTION: "upcoming",
        SHIPPED: "upcoming",
        DELIVERED: "upcoming",
      }
    : undefined;

  const effectiveStepOverrides: Partial<Record<ShippingStepKey, ShippingStepVisualState>> | undefined =
    previewDefaults || stepStateOverrides
      ? {
          ...previewDefaults,
          ...stepStateOverrides,
        }
      : undefined;

  return (
    <div className="mt-6">
      <div className="flex items-start">
        {timelineSteps.map((step, stepIdx) => {
          const defaultState: ShippingStepVisualState =
            step.statusIndex <= currentStatusIndex ? "completed" : "upcoming";
          const visualState = effectiveStepOverrides?.[step.key] ?? defaultState;
          const completed = visualState === "completed";
          const inProgress = visualState === "in_progress";
          const active = inProgress || step.statusIndex === currentStatusIndex;

          const circleClass = completed
            ? "border-primary bg-primary"
            : inProgress
              ? "border-primary bg-white"
              : "border-gray-300 bg-white";

          const iconClass = completed
            ? "text-white"
            : inProgress
              ? "text-primary"
              : "text-gray-400";

          const textClass = inProgress || active
            ? "text-primary"
            : completed
              ? "text-gray-700"
              : "text-gray-500";
          
          return (
            <React.Fragment key={step.name}>
              <div className="flex flex-col items-center" style={{ width: 80 }}>
                <div
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 overflow-hidden ${inProgress ? "border-primary bg-white" : circleClass}`}
                >
                  {inProgress ? (
                    <>
                      <div className="absolute inset-y-0 left-0 w-1/2 bg-primary" />
                      {/* White icon clipped to the left (primary bg) half */}
                      <step.icon className="absolute h-6 w-6 text-white" aria-hidden="true" style={{ clipPath: "inset(0 50% 0 0)" }} />
                      {/* Primary icon clipped to the right (white bg) half */}
                      <step.icon className="absolute h-6 w-6 text-primary" aria-hidden="true" style={{ clipPath: "inset(0 0 0 50%)" }} />
                    </>
                  ) : (
                    <step.icon className={`h-6 w-6 ${iconClass}`} aria-hidden="true" />
                  )}
                </div>
                <div className="mt-3 text-center">
                  <p className={`text-sm font-medium whitespace-nowrap ${textClass}`}>
                    {step.name}
                  </p>
                  {step.date && (
                    <p className="text-xs text-gray-500 !text-center whitespace-nowrap">{step.date}</p>
                  )}
                </div>
              </div>
              {stepIdx < timelineSteps.length - 1 && (
                <div className="flex flex-1 items-center" style={{ height: 40 }}>
                  {(() => {
                    const nextStep = timelineSteps[stepIdx + 1];
                    const nextDefaultState: ShippingStepVisualState =
                      nextStep.statusIndex <= currentStatusIndex ? "completed" : "upcoming";
                    const nextState = effectiveStepOverrides?.[nextStep.key] ?? nextDefaultState;
                    const connectorComplete = completed && nextState !== "upcoming";
                    return (
                  <div
                        className={`h-0.5 w-full ${connectorComplete ? "bg-primary" : "bg-gray-300"}`}
                    aria-hidden="true"
                  />
                    );
                  })()}
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
