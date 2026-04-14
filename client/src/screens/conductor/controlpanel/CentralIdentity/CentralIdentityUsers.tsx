import { useRef, useState } from "react";
import { CentralIdentityUser } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import {
  getPrettyAuthSource,
  getPrettyUserType,
  getPrettyVerficationStatus,
  getPrettyAcademyOnlineAccessLevel,
} from "../../../../utils/centralIdentityHelpers";
import useDebounce from "../../../../hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import api from "../../../../api";
import { IconLockExclamation } from "@tabler/icons-react";
import { Breadcrumb, Container, Heading, Stack } from "@libretexts/davis-react";
import { ColumnFilter, DataTable } from "@libretexts/davis-react-table";
import type { Table, ColumnDef, ColumnFiltersState, SortingState } from "@libretexts/davis-react-table";

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
    )
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
    cell: ({ getValue }) => getPrettyUserType(getValue<string>()),
  },
  {
    accessorKey: "verify_status",
    header: "Verification Status",
    cell: ({ row }) => {
      return row.original.user_type === "instructor" ? (
        <span>
          {getPrettyVerficationStatus(row.original.verify_status)}
        </span>
      ) : (
        <span className="muted-text">N/A</span>
      );
    },
  },
  {
    accessorKey: "academy_online",
    header: ({ column }) => (
      <div className="flex flex-col gap-1">
        <span>Academy Online Access</span>
        <ColumnFilter column={column} placeholder="e.g. 1,2" />
      </div>
    ),
    cell: ({ getValue }) => getPrettyAcademyOnlineAccessLevel(getValue<number>()),
  },
  {
    accessorKey: "external_idp",
    header: "Auth Source",
    cell: ({ getValue, row }) => (
      <span>
        {getValue<string>()
          ? getPrettyAuthSource(getValue<string>())
          : "LibreOne"}
        {row.original.disabled && " (Disabled)"}
      </span>
    )
  },
]


const CentralIdentityUsers = () => {
  //Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  //UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [sortChoice, setSortChoice] = useState<string>("first");
  const [searchString, setSearchString] = useState<string>("");
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [academyFilters, setAcademyFilters] = useState<string[]>([]);

  const SORT_COLUMN_MAP: Record<string, string> = {
    first_name: "first",
    last_name: "last",
    email: "email",
    external_idp: "auth",
  };

  const tableRef = useRef<Table<CentralIdentityUser> | null>(null);

  //Data
  const { data: users, isLoading } = useQuery<CentralIdentityUser[]>({
    queryKey: [
      "central-identity-users",
      activePage,
      itemsPerPage,
      sortChoice,
      searchString,
      sortChoice,
      academyFilters,
    ],
    queryFn: () =>
      getUsers({
        activePage,
        itemsPerPage,
        searchString,
        sortChoice,
      }),
    keepPreviousData: true,
  });

  // Handlers & Methods
  async function getUsers({
    activePage,
    itemsPerPage,
    searchString,
    sortChoice,
  }: {
    activePage: number;
    itemsPerPage: number;
    searchString: string;
    sortChoice: string;
  }) {
    try {
      const res = await api.getCentralIdentityUsers({
        page: activePage,
        limit: itemsPerPage,
        query: searchString,
        sort: sortChoice,
        academy_online: academyFilters.map(Number),
      });

      if (
        res.data.err ||
        !res.data.users ||
        !Array.isArray(res.data.users) ||
        res.data.total === undefined
      ) {
        throw new Error("Error retrieving users");
      }

      setTotalItems(res.data.total);

      return res.data.users;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  const getUsersDebounced = debounce((searchVal: string) => {
    setActivePage(1); // Reset to first page on new search
    setSearchString(searchVal);
  }, 250);

  const parseCsvFilterValues = (rawValue: unknown) => {
    if (typeof rawValue !== "string") {
      return [];
    }

    return rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  };

  const paginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  return (
    <div className="!pt-32 !bg-white !h-full !px-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>LibreOne Admin Consoles: Users</Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/libreone">LibreOne Admin Consoles</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Users</Breadcrumb.Item>
        </Breadcrumb>
        <DataTable<CentralIdentityUser>
          data={users || []}
          columns={columns}
          loading={isLoading}
          density="compact"
          onRowClick={(record) => {
            window.open(`/controlpanel/libreone/users/${record.uuid}`);
          }}
          enableSorting
          enablePagination
          enableGlobalFilter
          enableColumnFilters
          pageSize={itemsPerPage}
          pageSizeOptions={[10, 25, 50, 100]}
          onTableReady={(table) => (tableRef.current = table)}
          tableOptions={{
            manualPagination: true,
            manualFiltering: true,
            manualSorting: true,
            rowCount: totalItems,
            state: {
              pagination: paginationState,
              globalFilter,
              columnFilters,
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

              const [firstSort] = nextSorting;
              setSortChoice(
                firstSort ? (SORT_COLUMN_MAP[firstSort.id] ?? "first") : "first"
              );
            },
            onGlobalFilterChange: (updater) => {
              const nextGlobalFilter =
                typeof updater === "function"
                  ? updater(globalFilter)
                  : updater;

              const normalized = typeof nextGlobalFilter === "string" ? nextGlobalFilter : "";
              setGlobalFilter(normalized);
              getUsersDebounced(normalized);
            },
            onColumnFiltersChange: (updater) => {
              const nextColumnFilters =
                typeof updater === "function"
                  ? updater(columnFilters)
                  : updater;

              setColumnFilters(nextColumnFilters);
              setActivePage(1);

              const academyOnlineFilter = nextColumnFilters.find(
                (filter) => filter.id === "academy_online"
              );

              setAcademyFilters(parseCsvFilterValues(academyOnlineFilter?.value));
            },
          }}
          toolbar={{
            globalSearch: true
          }}
        />

      </Stack>
    </div>
  );
};

export default CentralIdentityUsers;
