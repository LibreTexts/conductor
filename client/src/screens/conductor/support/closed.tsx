import DefaultLayout from "../../../components/kb/DefaultLayout";
import { useEffect, useState } from "react";
import {
  getPrettySupportTicketCategory,
  isSupportStaff,
} from "../../../utils/supportHelpers";
import { PaginationWithItemsSelect } from "../../../components/util/PaginationWithItemsSelect";
import { Button, Icon } from "semantic-ui-react";
import { capitalizeFirstLetter } from "../../../components/util/HelperFunctions";
import { format, parseISO } from "date-fns";
import { getRequesterText } from "../../../utils/kbHelpers";
import { SupportTicket } from "../../../types";
import axios from "axios";
import useGlobalError from "../../../components/error/ErrorHooks";
import SupportCenterTable from "../../../components/support/SupportCenterTable";
import { Link } from "react-router-dom";
import { useTypedSelector } from "../../../state/hooks";

const SupportDashboard = () => {
  const user = useTypedSelector((state) => state.user);
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [closedTickets, setClosedTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    document.title = "LibreTexts | Closed Tickets";
    getClosedTickets();
  }, []);

  useEffect(() => {
    getClosedTickets();
  }, [activePage, itemsPerPage, activeSort]);

  async function getClosedTickets() {
    try {
      setLoading(true);
      const res = await axios.get("/support/ticket/closed", {
        params: {
          page: activePage,
          limit: itemsPerPage,
          sort: activeSort,
        },
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.tickets || !Array.isArray(res.data.tickets)) {
        throw new Error("Invalid response from server");
      }

      setTotalItems(res.data.total);
      setTotalPages(Math.ceil(res.data.total / itemsPerPage));
      setClosedTickets(res.data.tickets);
    } catch (err) {
      handleGlobalError(err);
      return [];
    } finally {
      setLoading(false);
    }
  }

  return (
    <DefaultLayout>
      <div className="flex flex-col p-8" aria-busy={loading}>
        <div className="flex flex-row justify-between items-center">
          <p className="text-4xl font-semibold">Closed Tickets</p>
          {isSupportStaff(user) && (
            <div className="flex flex-row">
              <Button
                color="blue"
                size="tiny"
                basic
                onClick={() => (window.location.href = "/support/dashboard")}
              >
                <Icon name="clock outline" />
                View Open Tickets
              </Button>
            </div>
          )}
        </div>
        <div className="mt-12">
          <PaginationWithItemsSelect
            activePage={activePage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            setActivePageFn={setActivePage}
            setItemsPerPageFn={setItemsPerPage}
            totalLength={totalItems}
            sort={true}
            sortOptions={["opened", "closed", "priority"]}
            activeSort={activeSort}
            setActiveSortFn={setActiveSort}
          />
          <SupportCenterTable<SupportTicket & { actions?: string }>
            className="!my-4"
            loading={loading}
            data={closedTickets}
            columns={[
              {
                accessor: "uuid",
                title: "ID",
                render(record, index) {
                  return record.uuid.slice(-7);
                },
              },
              {
                accessor: "timeOpened",
                title: "Date Opened",
                render(record) {
                  return format(
                    parseISO(record.timeOpened),
                    "MM/dd/yyyy hh:mm aa",
                  );
                },
              },
              {
                accessor: "title",
                title: "Subject",
                className: "!w-full !max-w-[40rem] break-words truncate",
                render(record) {
                  return record.title;
                },
              },
              {
                accessor: "category",
                title: "Category",
                render(record) {
                  return getPrettySupportTicketCategory(record.category);
                },
              },
              {
                accessor: "user",
                title: "Requester",
                render(record) {
                  return getRequesterText(record);
                },
              },
              {
                accessor: "assignedUsers",
                title: "Assigned To",
                render(record) {
                  return record.assignedUsers
                    ? record.assignedUsers.map((u) => u.firstName).join(", ")
                    : "Unassigned";
                },
              },
              {
                accessor: "priority",
                render(record) {
                  return capitalizeFirstLetter(record.priority);
                },
              },
              {
                accessor: "timeClosed",
                title: "Date Closed",
                render(record) {
                  if (!record.timeClosed) return "N/A";
                  return format(
                    parseISO(record.timeClosed),
                    "MM/dd/yyyy hh:mm aa",
                  );
                },
              },
              {
                accessor: "actions",
                render(record) {
                  return (
                    <div className="flex flex-row whitespace-nowrap">
                      <Button
                        color="blue"
                        size="tiny"
                        to={`/support/ticket/${record.uuid}`}
                        target="_blank"
                        as={Link}
                        className="inline-flex"
                      >
                        <Icon name="eye" />
                        View
                      </Button>
                    </div>
                  );
                },
              },
            ]}
          />
          <PaginationWithItemsSelect
            activePage={activePage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            setActivePageFn={setActivePage}
            setItemsPerPageFn={setItemsPerPage}
            totalLength={totalItems}
            sort={true}
            sortOptions={["opened", "closed", "priority"]}
            activeSort={activeSort}
            setActiveSortFn={setActiveSort}
          />
        </div>
      </div>
    </DefaultLayout>
  );
};

export default SupportDashboard;
