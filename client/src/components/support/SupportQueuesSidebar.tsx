import useSupportQueues from "../../hooks/useSupportQueues";
import useSupportQueueMetrics from "../../hooks/useSupportQueueMetrics";
import {
  IconChevronLeft,
  IconChevronRight,
  IconMenu2,
} from "@tabler/icons-react";
import { useSupportCenterContext } from "../../context/SupportCenterContext";
import { useTypedSelector } from "../../state/hooks";
import { useMemo } from "react";
import classNames from "classnames";
import DynamicIcon, { DynamicIconName } from "../NextGenComponents/DynamicIcon";

interface SupportQueuesSidebarProps {
  showMetrics?: boolean;
  showCounts?: boolean;
}

const SupportQueuesSidebar: React.FC<SupportQueuesSidebarProps> = ({
  showMetrics = false,
  showCounts = false,
}) => {
  const user = useTypedSelector((state) => state.user);
  const {
    selectedQueue,
    setSelectedQueue,
    queueDrawerOpen,
    setQueueDrawerOpen,
  } = useSupportCenterContext();

  const { data: queues, isFetching: queuesFetching } = useSupportQueues({
    withCount: showCounts,
  });

  const { data: supportMetrics, isFetching: isFetchingMetrics } =
    useSupportQueueMetrics({
      slug: selectedQueue,
      enabled: showMetrics,
    });

  const availableQueues = useMemo(() => {
    if (user.isHarvester) {
      return queues?.filter((queue) => queue.slug === "harvesting") || [];
    }
    return queues || [];
  }, [queues, user]);

  return (
    <div
      className={classNames(
        "flex flex-col mb-1 p-8 h-fill border-r border-slate-300",
        queueDrawerOpen ? "min-w-[15%]" : "w-[1rem] items-center"
      )}
    >
      {queueDrawerOpen ? (
        <>
          <div className="flex flex-row justify-between items-center mb-6 mt-2">
            <h2 className="text-2xl font-semibold">Queues</h2>
            <IconChevronLeft
              className="w-6 h-6 text-gray-400 cursor-pointer"
              onClick={() => setQueueDrawerOpen(false)}
            />
          </div>
          {availableQueues.map((queue) => (
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
        </>
      ) : (
        <div className="flex flex-col items-center cursor-pointer mt-2">
          <IconMenu2
            className="w-6 h-6 text-gray-400 cursor-pointer mb-4"
            onClick={() => setQueueDrawerOpen(true)}
          />
          {queues?.map((q) => (
            <DynamicIcon
              icon={q.icon as DynamicIconName}
              key={q.id}
              className={`!w-7 !h-7 mt-8 text-gray-400 hover:text-gray-600 hover:w-6 hover:h-6 transition-all`}
              onClick={() => {
                setSelectedQueue(q.slug);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SupportQueuesSidebar;
