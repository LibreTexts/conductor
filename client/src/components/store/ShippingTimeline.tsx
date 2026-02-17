import React from "react";
import { StoreShippingOption } from "../../types";
import { IconCheck, IconSettings, IconTruck, IconHome } from "@tabler/icons-react";

interface ShippingTimelineProps {
  shippingOption: StoreShippingOption;
}

export default function ShippingTimeline({ shippingOption }: ShippingTimelineProps) {
  if (
    !shippingOption.production_start_date_estimate ||
    !shippingOption.production_end_date_estimate ||
    !shippingOption.ship_date_start_estimate ||
    !shippingOption.ship_date_end_estimate ||
    !shippingOption.delivery_date_start_estimate ||
    !shippingOption.delivery_date_end_estimate
    ) {
    // Don't render if date fields are missing
    return null;
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const formatDateRange = (start: string, end: string): string => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayFormatted = formatDate(today.toISOString().split('T')[0]);

  const timelineSteps = [
    {
      name: "Order Placed",
      icon: IconCheck,
      date: `Today (${todayFormatted})`,
      completed: false,
    },
    {
      name: "Printing (On-Demand)",
      icon: IconSettings,
      date: formatDateRange(
        shippingOption.production_start_date_estimate,
        shippingOption.production_end_date_estimate
      ),
      completed: false,
    },
    {
      name: "Shipped",
      icon: IconTruck,
      date: formatDateRange(
        shippingOption.ship_date_start_estimate,
        shippingOption.ship_date_end_estimate
      ),
      completed: false,
    },
    {
      name: "Estimated Arrival",
      icon: IconHome,
      date: formatDateRange(
        shippingOption.delivery_date_start_estimate,
        shippingOption.delivery_date_end_estimate
      ),
      completed: false,
    },
  ];

  return (
    <div className="mt-6">
      {/* Title outside the box, matching "Order summary" style */}
      <h3 className="text-lg font-medium text-gray-900">
        Estimated Production & Delivery Timeline
      </h3>
      
      {/* Content box with same styling as order summary */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm px-4 py-6 sm:px-6">
        <div className="flex items-start">
          {timelineSteps.map((step, stepIdx) => (
            <React.Fragment key={step.name}>
              <div className="flex flex-col items-center" style={{ width: 80 }}>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                    step.completed
                      ? "border-primary bg-primary"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  <step.icon
                    className={`h-6 w-6 ${
                      step.completed ? "text-white" : "text-gray-400"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-3 text-center">
                  <p
                    className={`text-sm font-medium ${
                      step.completed ? "text-primary" : "text-gray-500"
                    }`}
                  >
                    {step.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 !text-center">{step.date}</p>
                </div>
              </div>
              {stepIdx < timelineSteps.length - 1 && (
                <div className="flex flex-1 items-center" style={{ height: 40 }}>
                  <div
                    className={`h-0.5 w-full ${
                      step.completed ? "bg-primary" : "bg-gray-300"
                    }`}
                    aria-hidden="true"
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        
        <p className="mt-6 text-sm text-gray-500 text-center">
          *Please note: Because your book is printed on demand and just for you,
          production times can vary before shipping begins.
        </p>
      </div>
    </div>
  );
}