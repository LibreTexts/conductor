import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { useState, useEffect, lazy, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconSearch } from "@tabler/icons-react";
import useGlobalError from "../../../components/error/ErrorHooks";
import { useNotifications } from "../../../context/NotificationContext";
import { useTypedSelector } from "../../../state/hooks";
import useDebounce from "../../../hooks/useDebounce";
import useSupportTicketFilters from "../../../hooks/useSupportTicketFilters";
import useSupportTickets from "../../../hooks/useSupportTickets";
import SupportQueuesSidebar from "../../../components/support/SupportQueuesSidebar";
import Input from "../../../components/NextGenInputs/Input";
import Combobox from "../../../components/NextGenInputs/Combobox";
import { TicketPagination } from "../../../components/support/TicketPagination";
import TicketTable from "../../../components/support/TicketTable";
import useUserSupportTickets from "../../../hooks/useUserSupportTickets";
import Button from "../../../components/NextGenComponents/Button";
import { useSupportCenterContext } from "../../../context/SupportCenterContext";
import { useModals } from "../../../context/ModalContext";
import BulkChangeModal from "../../../components/support/BulkChangeModal";
import { useDocumentTitle } from "usehooks-ts";
const AssignTicketModal = lazy(
  () => import("../../../components/support/AssignTicketModal")
);
const SupportCenterSettingsModal = lazy(
  () => import("../../../components/support/SupportCenterSettingsModal")
);

const SupportDashboard = () => {
  useDocumentTitle("LibreTexts | Support Dashboard");
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const { openModal, closeAllModals } = useModals();
  const queryClient = useQueryClient();
  const user = useTypedSelector((state) => state.user);
  const { debounce } = useDebounce();
  const { selectedQueue, selectedTickets } = useSupportCenterContext();

  const itemsPerPage = 25;
  const [queryInputString, setQueryInputString] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [activePage, setActivePage] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [totalPages, setTotalPages] = useState<number>(1);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);

  const { data: ticketFilters, isFetching: isFetchingFilters } =
    useSupportTicketFilters();

  const { data: openTickets, isFetching } = useSupportTickets(selectedQueue, {
    query: query,
    page: activePage,
    items: itemsPerPage,
    sort: activeSort,
    assigneeFilters,
    priorityFilters,
    categoryFilters,
    enabled: user.isSupport || user.isSuperAdmin,
  });

  const { data: userTickets, isFetching: isFetchingUserTickets } =
    useUserSupportTickets({
      activePage,
      itemsPerPage,
      queue: selectedQueue,
      enabled: !user.isSupport && !user.isSuperAdmin,
    });

  const debouncedQueryUpdate = debounce(
    (searchString: string) => setQuery(searchString),
    300
  );

  function openAssignModal(ticketId: string) {
    setSelectedTicketId(ticketId);
    setShowAssignModal(true);
  }

  function onCloseAssignModal() {
    setShowAssignModal(false);
    setSelectedTicketId("");
    queryClient.invalidateQueries(["openTickets"]);
  }

  function getAssigneeName(uuid: string) {
    const user = openTickets?.tickets.find((t) =>
      t.assignedUsers?.find((u) => u.uuid === uuid)
    );
    if (user) {
      return user.assignedUsers?.find((u) => u.uuid === uuid)?.firstName;
    } else {
      return "";
    }
  }

  return (
    <AlternateLayout>
      <div className="flex flex-row">
        <SupportQueuesSidebar
          showCounts={user.isSupport || user.isSuperAdmin}
          showMetrics={user.isSupport || user.isSuperAdmin}
        />
        <div className="flex flex-col w-full p-8 bg-gray-100/50">
          <div className="w-full overflow-x-auto !pr-12">
            <div className="flex justify-between">
              <div className="flex flex-col mb-4">
                <p className="text-3xl font-semibold mb-2 capitalize">
                  {selectedQueue} - Open Tickets
                </p>
                <div className="flex flex-row items-end space-x-3">
                  <Input
                    name="search-tickets"
                    label="Search"
                    placeholder="Search tickets..."
                    value={queryInputString}
                    onChange={(e) => {
                      setQueryInputString(e.target.value);
                      debouncedQueryUpdate(e.target.value);
                    }}
                    className="w-80"
                    leftIcon={<IconSearch className="size-5 text-gray-400" />}
                  />
                  <Combobox
                    name="assignee-filter"
                    label="Assignee"
                    items={ticketFilters?.filters.assignee || []}
                    multiple={true}
                    onChange={(values) => setAssigneeFilters(values)}
                    loading={isFetchingFilters}
                  />
                  <Combobox
                    name="priority-filter"
                    label="Priority"
                    items={ticketFilters?.filters.priority || []}
                    multiple={true}
                    onChange={(values) => setPriorityFilters(values)}
                    loading={isFetchingFilters}
                  />
                  <Combobox
                    name="category-filter"
                    label="Category"
                    items={ticketFilters?.filters.category || []}
                    multiple={true}
                    onChange={(values) => setCategoryFilters(values)}
                    loading={isFetchingFilters}
                  />
                  {selectedTickets.length > 0 && (
                    <Button
                      color="blue"
                      onClick={() =>
                        openModal(
                          <BulkChangeModal
                            open={true}
                            onCancel={() => {
                              closeAllModals();
                            }}
                            onSave={() => {
                              closeAllModals();
                            }}
                          />
                        )
                      }
                      className="h-10"
                      icon="IconPencilBolt"
                    >
                      <span className="pb-0.5">Bulk Change</span>
                    </Button>
                  )}
                </div>
                <TicketPagination
                  itemsPerPage={itemsPerPage}
                  totalItems={openTickets?.total || 0}
                  onPageChange={(page) => setActivePage(page)}
                  className="mt-2"
                />
              </div>
              <Button
                color="blue"
                onClick={() =>
                  (window.location.href = `/support/contact?queue=${selectedQueue}`)
                }
                className="h-10 self-start"
                icon="IconPlus"
              >
                <span className="pb-0.5">Create New Ticket</span>
              </Button>
            </div>
            <TicketTable
              data={
                user.isSupport || user.isSuperAdmin
                  ? openTickets?.tickets || []
                  : userTickets?.tickets || []
              }
              showSelect={true}
              showAssigned={true}
            />
          </div>
        </div>
        <SupportCenterSettingsModal
          open={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
        {selectedTicketId && (
          <AssignTicketModal
            open={showAssignModal}
            onClose={onCloseAssignModal}
            ticketId={selectedTicketId}
          />
        )}
      </div>
    </AlternateLayout>
  );
};

export default SupportDashboard;
