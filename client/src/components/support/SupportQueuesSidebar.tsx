import useSupportQueues from "../../hooks/useSupportQueues";
import useSupportQueueMetrics from "../../hooks/useSupportQueueMetrics";
import { IconChevronRight } from "@tabler/icons-react";
import { useSupportCenterContext } from "../../context/SupportCenterContext";

interface SupportQueuesSidebarProps {
  showMetrics?: boolean;
  showCounts?: boolean;
}

const SupportQueuesSidebar: React.FC<SupportQueuesSidebarProps> = ({
  showMetrics = false,
  showCounts = false,
}) => {
  const { selectedQueue, setSelectedQueue } = useSupportCenterContext();
  const { data: queues, isFetching: queuesFetching } = useSupportQueues({
    withCount: showCounts,
  });

  const { data: supportMetrics, isFetching: isFetchingMetrics } =
    useSupportQueueMetrics({
      slug: selectedQueue,
      enabled: showMetrics,
    });

  return (
    <div className="flex flex-col mb-1 p-8 h-fill min-w-[15%] border-r border-slate-300">
      <h2 className="text-2xl font-semibold mb-4">Queues</h2>
      {queues?.map((queue) => (
        <button
          key={queue.id}
          onClick={() => setSelectedQueue(queue.slug)}
          className={`w-full flex items-center justify-between p-4 rounded-lg transition-all duration-200 group hover:bg-gray-50 ${
            selectedQueue === queue.slug
              ? "bg-blue-50 border-2 border-blue-200"
              : "border-2 border-transparent hover:border-gray-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${queue.color}`}></div>
            <div className="text-left">
              <div className="font-medium text-gray-900">{queue.name}</div>
              {showCounts && (
                <div className="text-sm text-gray-500">
                  {queue.ticket_count || 0} tickets
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <IconChevronRight
              className={`w-4 h-4 text-gray-400 transition-transform ${
                selectedQueue === queue.slug ? "rotate-90" : ""
              }`}
            />
          </div>
        </button>
      ))}
      {showMetrics && (
        <div className="flex flex-col w-full mt-4 space-y-4">
          <div className="mt-8 p-4 bg-gray-100 rounded-lg border border-slate-300">
            <h3 className="font-semibold text-gray-900 mb-3 capitalize">
              {selectedQueue} Summary
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Open tickets</span>
                <span className="text-sm font-medium">
                  {supportMetrics?.total_open_tickets}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">New tickets (last 7 days)</span>
                <span className="text-sm font-medium">
                  {supportMetrics?.tickets_opened_last_7_days}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Avg resolution time</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.floor(
                    (supportMetrics?.avg_mins_to_close || 0) / (60 * 24)
                  )}{" "}
                  days
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportQueuesSidebar;
