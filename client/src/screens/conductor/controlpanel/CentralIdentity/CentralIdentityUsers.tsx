import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CentralIdentitySortOrder,
  CentralIdentityUser,
  CentralIdentityUserSort,
} from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import {
  academyOnlineAccessLevels,
  getPrettyAuthSource,
  getPrettyUserType,
  getPrettyVerficationStatus,
  getPrettyAcademyOnlineAccessLevel,
} from "../../../../utils/centralIdentityHelpers";
import useDebounce from "../../../../hooks/useDebounce";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import { IconLockExclamation } from "@tabler/icons-react";
import {
  Breadcrumb,
  Checkbox,
  Heading,
  Popover,
  Stack,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef, SortingState } from "@libretexts/davis-react-table";

/**
 * Maps table column ids onto the sort fields LibreOne's `GET /users` accepts.
 * Columns absent from this map cannot be sorted server-side and carry
 * `enableSorting: false` below.
 */
const SORT_COLUMN_MAP: Record<string, CentralIdentityUserSort> = {
  first_name: "first_name",
  last_name: "last_name",
  email: "email",
};

const columns: ColumnDef<CentralIdentityUser>[] = [
  {
    accessorKey: "first_name",
    header: "First Name",
    cell: ({ getValue, row }) => (
      <div className="flex items-center">
        <span>{getValue<string>()} </span>
        {row.original.disabled && (
          <IconLockExclamation className="h-5 w-5 ml-1" />
        )}
      </div>
    ),
  },
  {
    accessorKey: "last_name",
    header: "Last Name",
    cell: ({ getValue, row }) => (
      <div className="flex items-center">
        <span>{getValue<string>()} </span>
        {row.original.disabled && (
          <IconLockExclamation className="h-5 w-5 ml-1" />
        )}
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ getValue, row }) => (
      <div className="flex items-center">
        <span>{getValue<string>()} </span>
        {row.original.disabled && (
          <IconLockExclamation className="h-5 w-5 ml-1" />
        )}
      </div>
    ),
  },
  {
    accessorKey: "user_type",
    header: "User Type",
    enableSorting: false,
    cell: ({ getValue }) => getPrettyUserType(getValue<string>()),
  },
  {
    accessorKey: "verify_status",
    header: "Verification Status",
    enableSorting: false,
    cell: ({ row }) => {
      return row.original.user_type === "instructor" ? (
        <span>{getPrettyVerficationStatus(row.original.verify_status)}</span>
      ) : (
        <span className="muted-text">N/A</span>
      );
    },
  },
  {
    accessorKey: "academy_online",
    header: "Academy Online Access",
    enableSorting: false,
    cell: ({ getValue }) =>
      getPrettyAcademyOnlineAccessLevel(getValue<number>()),
  },
  {
    accessorKey: "external_idp",
    header: "Auth Source",
    enableSorting: false,
    cell: ({ getValue, row }) => (
      <span>
        {getValue<string>()
          ? getPrettyAuthSource(getValue<string>())
          : "LibreOne"}
        {row.original.disabled && " (Disabled)"}
      </span>
    ),
  },
];

type UsersQueryParams = {
  page: number;
  limit: number;
  query: string;
  sort?: CentralIdentityUserSort;
  order?: CentralIdentitySortOrder;
  academyOnline: number[];
};

const usersQueryKey = (params: UsersQueryParams) =>
  [
    "central-identity-users",
    params.page,
    params.limit,
    params.query,
    params.sort ?? null,
    params.order ?? null,
    params.academyOnline,
  ] as const;

async function fetchUsers(params: UsersQueryParams) {
  const res = await api.getCentralIdentityUsers({
    page: params.page,
    limit: params.limit,
    query: params.query || undefined,
    sort: params.sort,
    order: params.order,
    academy_online: params.academyOnline,
  });

  if (
    res.data.err ||
    !Array.isArray(res.data.users) ||
    res.data.total === undefined
  ) {
    throw new Error("Error retrieving users");
  }

  return { users: res.data.users, total: res.data.total };
}

const CentralIdentityUsers = () => {
  //Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const queryClient = useQueryClient();

  //UI
  const [activePage, setActivePage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [searchString, setSearchString] = useState<string>("");
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [academyFilters, setAcademyFilters] = useState<number[]>([]);

  // An empty `sorting` state deliberately sends no sort/order at all, which is
  // what lets LibreOne rank search results by relevance.
  const [firstSort] = sorting;
  const sortChoice = firstSort ? SORT_COLUMN_MAP[firstSort.id] : undefined;
  const sortOrder: CentralIdentitySortOrder | undefined = sortChoice
    ? firstSort.desc
      ? "desc"
      : "asc"
    : undefined;

  const queryParams: UsersQueryParams = {
    page: activePage,
    limit: itemsPerPage,
    query: searchString,
    ...(sortChoice ? { sort: sortChoice } : {}),
    ...(sortOrder ? { order: sortOrder } : {}),
    academyOnline: academyFilters,
  };

  //Data
  const { data, isLoading, isFetching } = useQuery({
    queryKey: usersQueryKey(queryParams),
    queryFn: () => fetchUsers(queryParams),
    keepPreviousData: true,
    staleTime: 30 * 1000,
    onError: (err) => handleGlobalError(err),
  });

  const users = data?.users ?? [];
  const totalItems = data?.total ?? 0;
  const isRefreshing = isFetching && !isLoading;

  // Warm the next page so paging forward renders instantly. Prefetch failures are
  // swallowed by React Query and never surface to the user.
  const hasNextPage = activePage * itemsPerPage < totalItems;
  useEffect(() => {
    if (!hasNextPage || isFetching) return;
    const nextPageParams: UsersQueryParams = {
      ...queryParams,
      page: activePage + 1,
    };
    queryClient.prefetchQuery({
      queryKey: usersQueryKey(nextPageParams),
      queryFn: () => fetchUsers(nextPageParams),
      staleTime: 30 * 1000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasNextPage,
    isFetching,
    activePage,
    itemsPerPage,
    searchString,
    sortChoice,
    sortOrder,
    academyFilters,
  ]);

  // Handlers & Methods
  const getUsersDebounced = useMemo(
    () =>
      debounce((searchVal: string) => {
        setActivePage(1); // Reset to first page on new search
        setSearchString(searchVal);
      }, 250),
    []
  );

  const toggleAcademyFilter = useCallback((level: number, checked: boolean) => {
    setActivePage(1);
    setAcademyFilters((prev) =>
      checked ? [...prev, level] : prev.filter((value) => value !== level)
    );
  }, []);

  const paginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  const academyFilterLabel = academyFilters.length
    ? `Academy Online (${academyFilters.length})`
    : "Academy Online";

  return (
    <div className="!h-full !p-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>LibreOne Admin Consoles: Users</Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/libreone">
            LibreOne Admin Consoles
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Users</Breadcrumb.Item>
        </Breadcrumb>
        <p aria-live="polite" className="sr-only">
          {isRefreshing ? "Updating users" : ""}
        </p>
        {/* Rendered above the table rather than in the DataTable toolbar: Davis
            nests the toolbar inside its wrapper div, which is `overflow-auto`,
            so an absolutely positioned popover placed there gets clipped. */}
        <div className="flex items-center">
          <Popover>
            <Popover.Button className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm">
              {academyFilterLabel}
            </Popover.Button>
            <Popover.Panel className="p-3 min-w-64">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">
                  Academy Online access
                </legend>
                <div className="flex flex-col gap-2">
                  {academyOnlineAccessLevels.map((level) => (
                    <Checkbox
                      key={level.key}
                      name={`academy-online-${level.value}`}
                      label={`${level.value} - ${level.text}`}
                      checked={academyFilters.includes(level.value)}
                      onChange={(checked) =>
                        toggleAcademyFilter(level.value, checked)
                      }
                    />
                  ))}
                </div>
                {academyFilters.length > 0 && (
                  <button
                    type="button"
                    className="mt-3 text-sm underline"
                    onClick={() => {
                      setActivePage(1);
                      setAcademyFilters([]);
                    }}
                  >
                    Clear filter
                  </button>
                )}
              </fieldset>
            </Popover.Panel>
          </Popover>
        </div>
        <div
          aria-busy={isRefreshing}
          className={
            isRefreshing
              ? "opacity-60 pointer-events-none transition-opacity duration-150"
              : "transition-opacity duration-150"
          }
        >
          <DataTable<CentralIdentityUser>
            data={users}
            columns={columns}
            loading={isLoading}
            density="compact"
            caption="LibreOne users"
            onRowClick={(record) => {
              window.open(`/controlpanel/libreone/users/${record.uuid}`);
            }}
            enableSorting
            enablePagination
            enableGlobalFilter
            pageSize={itemsPerPage}
            pageSizeOptions={[10, 25, 50, 100]}
            tableOptions={{
              manualPagination: true,
              manualFiltering: true,
              manualSorting: true,
              // NOTE: Davis's DataTablePagination derives its "Showing X-Y of Z"
              // text from getFilteredRowModel().rows.length, which under
              // manualPagination is only the current page's row count, so the
              // range reads e.g. "Showing 1-25 of 25" on every page. Page numbers
              // and the next/prev controls honour `rowCount` correctly. Pending an
              // upstream Davis fix (it should prefer table.getRowCount() when
              // manualPagination is on); deliberately not worked around here.
              rowCount: totalItems,
              state: {
                pagination: paginationState,
                globalFilter,
                sorting,
              },
              onPaginationChange: (updater) => {
                const nextPagination =
                  typeof updater === "function"
                    ? updater(paginationState)
                    : updater;

                setActivePage(nextPagination.pageIndex + 1);
                setItemsPerPage(nextPagination.pageSize);
              },
              onSortingChange: (updater) => {
                const nextSorting =
                  typeof updater === "function" ? updater(sorting) : updater;

                setSorting(nextSorting);
                setActivePage(1);
              },
              onGlobalFilterChange: (updater) => {
                const nextGlobalFilter =
                  typeof updater === "function"
                    ? updater(globalFilter)
                    : updater;

                const normalized =
                  typeof nextGlobalFilter === "string" ? nextGlobalFilter : "";
                setGlobalFilter(normalized);
                getUsersDebounced(normalized);
              },
            }}
            toolbar={{
              globalSearch: true,
              globalSearchPlaceholder: "Search name, email, or UUID",
            }}
          />
        </div>
      </Stack>
    </div>
  );
};

export default CentralIdentityUsers;
