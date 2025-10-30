import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { useState } from "react";
import { SupportTicket } from "../../../types";
import axios from "axios";
import { useDocumentTitle } from "usehooks-ts";
import { useQuery } from "@tanstack/react-query";
import TicketTable from "../../../components/support/TicketTable";
import Button from "../../../components/NextGenComponents/Button";
import { TicketPagination } from "../../../components/support/TicketPagination";
import Input from "../../../components/NextGenInputs/Input";
import { IconSearch } from "@tabler/icons-react";
import useDebounce from "../../../hooks/useDebounce";
import Combobox from "../../../components/NextGenInputs/Combobox";
import useSupportTicketFilters from "../../../hooks/useSupportTicketFilters";

const SupportDashboard = () => {
  useDocumentTitle("LibreTexts | Closed Tickets");
  const { debounce } = useDebounce();

  const itemsPerPage = 25;
  const [queryInputString, setQueryInputString] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [activePage, setActivePage] = useState<number>(1);
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);

  const { data: ticketFilters, isFetching: isFetchingFilters } =
    useSupportTicketFilters();

  const { data, isFetching } = useQuery<{
    tickets: SupportTicket[];
    total: number;
  }>({
    queryKey: ["closedSupportTickets", activePage, query, assigneeFilters, priorityFilters, categoryFilters],
    queryFn: async () => {
      const res = await axios.get("/support/ticket/closed", {
        params: {
          page: activePage,
          limit: itemsPerPage,
          query,
          ...(assigneeFilters.length > 0 && { assignee: assigneeFilters }),
          ...(priorityFilters.length > 0 && { priority: priorityFilters }),
          ...(categoryFilters.length > 0 && { category: categoryFilters }),
        },
      });
      return res.data;
    },
    meta: {
      errorMessage: "Failed to fetch closed support tickets.",
    },
  });

  const debouncedQueryUpdate = debounce(
    (searchString: string) => setQuery(searchString),
    300
  );

  return (
    <AlternateLayout>
      <div className="flex flex-col w-full p-8 bg-gray-100/50">
        <div className="w-full overflow-x-auto !pr-2">
          <div className="flex justify-between pt-1">
            <div className="flex flex-col mb-4">
              <p className="text-3xl font-semibold mb-2 capitalize">
                Closed Tickets
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
                  value={assigneeFilters}
                  onChange={(values) => setAssigneeFilters(values)}
                  loading={isFetchingFilters}
                />
                <Combobox
                  name="priority-filter"
                  label="Priority"
                  items={ticketFilters?.filters.priority || []}
                  multiple={true}
                  value={priorityFilters}
                  onChange={(values) => setPriorityFilters(values)}
                  loading={isFetchingFilters}
                />
                <Combobox
                  name="category-filter"
                  label="Category"
                  items={ticketFilters?.filters.category || []}
                  multiple={true}
                  value={categoryFilters}
                  onChange={(values) => setCategoryFilters(values)}
                  loading={isFetchingFilters}
                />
              </div>
              <TicketPagination
                itemsPerPage={itemsPerPage}
                totalItems={data?.total || 0}
                onPageChange={(page) => setActivePage(page)}
                className="mt-2"
              />
            </div>
            <div className="flex flex-row space-x-3">
              <Button
                color="blue"
                onClick={() => (window.location.href = "/support/dashboard")}
                className="h-10 self-start"
                icon="IconDashboard"
              >
                <span className="pb-0.5">Back to Dashboard</span>
              </Button>
            </div>
          </div>
          <TicketTable
            data={data?.tickets || []}
            showSelect={false}
            showAssigned={false}
            forceCategoryColumn={true}
            forcePriorityColumn={false}
            loading={isFetching}
          />
        </div>
      </div>
    </AlternateLayout>
  );
};

export default SupportDashboard;
