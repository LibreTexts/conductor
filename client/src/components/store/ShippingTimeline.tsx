import { StoreShippingOption } from "../../types";
import { IconCheck, IconSettings, IconTruck, IconHome } from "@tabler/icons-react";

interface ShippingTimelineProps {
  shippingOption: StoreShippingOption;
}

export default function ShippingTimeline({ shippingOption }: ShippingTimelineProps) {
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
      completed: true,
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
    <div className="mt-10 border-t border-gray-200 pt-10">
      <h3 className="text-lg font-medium text-gray-900">
        Estimated Production & Delivery Timeline
      </h3>
      <div className="mt-6">
        <div className="flex items-center justify-between">
          {timelineSteps.map((step, stepIdx) => (
            <div key={step.name} className="flex flex-col items-center flex-1">
              <div className="relative flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                    step.completed
                      ? "border-indigo-600 bg-indigo-600"
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
                {stepIdx < timelineSteps.length - 1 && (
                  <div
                    className={`absolute left-1/2 top-5 h-0.5 w-full ${
                      step.completed ? "bg-indigo-600" : "bg-gray-300"
                    }`}
                    style={{ transform: "translateX(50%)" }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="mt-4 text-center">
                <p
                  className={`text-sm font-medium ${
                    step.completed ? "text-indigo-600" : "text-gray-500"
                  }`}
                >
                  {step.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">{step.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-6 text-sm text-gray-500">
        *Please note: Because your book is printed specially for you upon ordering,
        production times can vary before shipping begins.
      </p>
    </div>
  );
}