import { useQuery } from "@tanstack/react-query";
import { SupportTicket } from "../types";
import { useTypedSelector } from "../state/hooks";
import api from "../api";
import useGlobalError from "../components/error/ErrorHooks";

const useUserSupportTickets = ({
  activePage,
  itemsPerPage,
  queue,
  enabled = true,
}: {
  activePage: number;
  itemsPerPage: number;
  queue?: string;
  enabled?: boolean;
}) => {
  const QUERY_KEY = ["userTickets", activePage, itemsPerPage, "opened", queue];
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);

  const queryObj = useQuery<{
    tickets: SupportTicket[];
    total: number;
  }>({
    queryKey: QUERY_KEY,
    queryFn: () => getUserTickets(activePage, itemsPerPage, "opened", queue),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!user.uuid && enabled,
  });

  async function getUserTickets(
    page: number,
    limit: number,
    sort: string,
    queue?: string
  ) {
    try {
      if (!user.uuid) return { tickets: [], total: 0 };
      const res = await api.getUserSupportTickets({
        uuid: user.uuid,
        page,
        limit,
        sort,
        queue,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.tickets || !Array.isArray(res.data.tickets)) {
        throw new Error("Invalid response from server");
      }

      return {
        tickets: res.data.tickets,
        total: res.data.total,
      };
    } catch (err) {
      handleGlobalError(err);
      return {
        tickets: [],
        total: 0,
      };
    }
  }

  return {
    ...queryObj,
    QUERY_KEY,
  };
};

export default useUserSupportTickets;
