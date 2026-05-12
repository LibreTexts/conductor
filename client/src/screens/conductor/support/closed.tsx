import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { useState } from "react";
import { SupportTicket } from "../../../types";
import axios from "axios";
import { useDocumentTitle } from "usehooks-ts";
import { useQuery } from "@tanstack/react-query";
import TicketTable from "../../../components/support/TicketTable";
import { TicketPagination } from "../../../components/support/TicketPagination";
import { IconDashboard, IconSearch } from "@tabler/icons-react";
import useDebounce from "../../../hooks/useDebounce";
import useSupportTicketFilters from "../../../hooks/useSupportTicketFilters";
import { Button, Heading, Input, Listbox, Stack } from "@libretexts/davis-react";

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
    <AlternateLayout noPadding>
      <div className="flex flex-col w-full p-8 bg-gray-100/50">
        <div className="w-full overflow-x-auto !pr-2">
          <div className="flex flex-col">
            <div className="flex justify-between items-center">
              <Heading level={2} className="mb-2 capitalize">
                Closed Tickets
              </Heading>
              <Button
                variant="primary"
                onClick={() => (window.location.href = "/support/dashboard")}
                className="h-10 self-start"
                icon={<IconDashboard size={18} />}
              >
                Back to Dashboard
              </Button>
            </div>
            <Stack direction="horizontal" gap="md" align="end">
              <Input
                name="search-tickets"
                label="Search"
                placeholder="Search tickets..."
                value={queryInputString}
                onChange={(e) => {
                  setQueryInputString(e.target.value);
                  debouncedQueryUpdate(e.target.value);
                }}
                className="min-w-80!"
                leftIcon={<IconSearch className="size-5 text-gray-400" />}
              />
              <Listbox
                value={assigneeFilters}
                onChange={(v) => setAssigneeFilters(v)}
                multiple
                className="max-w-56!"
              >
                <Listbox.Button
                  displayValue={(v) => {
                    const vals = v as unknown as string[];
                    if (!vals.length) return "";
                    const items = ticketFilters?.filters.assignee || [];
                    return items
                      .filter((i) => vals.includes(i.value))
                      .map((i) => i.text)
                      .join(", ");
                  }}
                  placeholder="Assignee"
                />
                <Listbox.Options>
                  {(ticketFilters?.filters.assignee || []).map((item) => (
                    <Listbox.Option key={item.key} value={item.value}>
                      {item.text}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Listbox>
              <Listbox
                value={priorityFilters}
                onChange={(v) => setPriorityFilters(v)}
                multiple
                className="max-w-56!"
              >
                <Listbox.Button
                  displayValue={(v) => {
                    const vals = v as unknown as string[];
                    if (!vals.length) return "";
                    const items = ticketFilters?.filters.priority || [];
                    return items
                      .filter((i) => vals.includes(i.value))
                      .map((i) => i.text)
                      .join(", ");
                  }}
                  placeholder="Priority"
                />
                <Listbox.Options>
                  {(ticketFilters?.filters.priority || []).map((item) => (
                    <Listbox.Option key={item.key} value={item.value}>
                      {item.text}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Listbox>
              <Listbox
                value={categoryFilters}
                onChange={(v) => setCategoryFilters(v)}
                multiple
                className="max-w-56!"
              >
                <Listbox.Button
                  displayValue={(v) => {
                    const vals = v as unknown as string[];
                    if (!vals.length) return "";
                    const items = ticketFilters?.filters.category || [];
                    return items
                      .filter((i) => vals.includes(i.value))
                      .map((i) => i.text)
                      .join(", ");
                  }}
                  placeholder="Category"
                />
                <Listbox.Options>
                  {(ticketFilters?.filters.category || []).map((item) => (
                    <Listbox.Option key={item.key} value={item.value}>
                      {item.text}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Listbox>
            </Stack>
            <TicketPagination
              itemsPerPage={itemsPerPage}
              totalItems={data?.total || 0}
              onPageChange={(page) => setActivePage(page)}
            />
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
