import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { useState, lazy, useEffect } from "react";
import { IconSearch } from "@tabler/icons-react";
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
const SupportCenterSettingsModal = lazy(
  () => import("../../../components/support/SupportCenterSettingsModal")
);

const SupportDashboard = () => {
  useDocumentTitle("LibreTexts | Support Dashboard");
  const { openModal, closeAllModals } = useModals();
  const user = useTypedSelector((state) => state.user);
  const { debounce } = useDebounce();
  const { selectedQueue, selectedTickets, selectedQueueObject } =
    useSupportCenterContext();

  const itemsPerPage = 25;
  const [queryInputString, setQueryInputString] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [activePage, setActivePage] = useState<number>(1);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);

  const { data: ticketFilters, isFetching: isFetchingFilters } =
    useSupportTicketFilters();

  const {
    data: openTickets,
    isFetching,
    refetch: refetchOpenTickets,
  } = useSupportTickets(selectedQueue, {
    query: query,
    page: activePage,
    items: itemsPerPage,
    sort: "opened",
    assigneeFilters,
    priorityFilters,
    categoryFilters,
    enabled:
      user.isSupport || (user.isHarvester && selectedQueue === "harvesting"),
  });

  const {
    data: userTickets,
    isFetching: isFetchingUserTickets,
    refetch: refetchUserTickets,
  } = useUserSupportTickets({
    activePage,
    itemsPerPage,
    queue: selectedQueue,
    enabled: !user.isSupport && !user.isHarvester,
  });

  const debouncedQueryUpdate = debounce(
    (searchString: string) => setQuery(searchString),
    300
  );

  return (
    <AlternateLayout>
      <div className="flex flex-row">
        <SupportQueuesSidebar
          showCounts={user.isSupport}
          showMetrics={user.isSupport}
        />
        <div className="flex flex-col w-full p-8 bg-gray-100/50">
          <div className="w-full overflow-x-auto pr-2">
            <div className="flex flex-col w-full">
              <div className="flex justify-between w-full items-center pt-1">
                <p className="text-3xl font-semibold mb-2 capitalize">
                  {selectedQueue}
                </p>
                <div className="flex space-x-3">
                  <Button
                    color="blue"
                    variant="secondary"
                    onClick={() => (window.location.href = `/support/closed`)}
                    className="h-10 self-start"
                    icon="IconBellZ"
                  >
                    <span className="pb-0.5">View Closed Tickets</span>
                  </Button>
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
              </div>
              <div className="flex flex-col w-full">
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
                  {user.isSupport && (
                    <Combobox
                      name="assignee-filter"
                      label="Assignee"
                      items={ticketFilters?.filters.assignee || []}
                      multiple={true}
                      value={assigneeFilters}
                      onChange={(values) => setAssigneeFilters(values)}
                      loading={isFetchingFilters}
                    />
                  )}
                  {selectedQueueObject?.has_priorities && (
                    <Combobox
                      name="priority-filter"
                      label="Priority"
                      items={ticketFilters?.filters.priority || []}
                      multiple={true}
                      value={priorityFilters}
                      onChange={(values) => setPriorityFilters(values)}
                      loading={isFetchingFilters}
                    />
                  )}
                  {selectedQueueObject?.has_categories && (
                    <Combobox
                      name="category-filter"
                      label="Category"
                      items={ticketFilters?.filters.category || []}
                      multiple={true}
                      value={categoryFilters}
                      onChange={(values) => setCategoryFilters(values)}
                      loading={isFetchingFilters}
                    />
                  )}
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
                      <span className="">Change</span>
                    </Button>
                  )}
                </div>
                <div className="flex justify-between mt-2 w-full">
                  <TicketPagination
                    itemsPerPage={itemsPerPage}
                    totalItems={openTickets?.total || 0}
                    onPageChange={(page) => setActivePage(page)}
                  />
                  <Button
                    variant="primary"
                    icon="IconRefresh"
                    className="h-10"
                    size="small"
                    loading={isFetching || isFetchingUserTickets}
                    onClick={() => {
                      if (user.isSupport || user.isHarvester) {
                        refetchOpenTickets();
                      } else {
                        refetchUserTickets();
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <TicketTable
              data={
                user.isSupport || user.isHarvester
                  ? openTickets?.tickets || []
                  : userTickets?.tickets || []
              }
              showSelect={true}
              showAssigned={true}
              loading={isFetching || isFetchingUserTickets}
            />
          </div>
        </div>
        <SupportCenterSettingsModal
          open={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      </div>
    </AlternateLayout>
  );
};

export default SupportDashboard;
