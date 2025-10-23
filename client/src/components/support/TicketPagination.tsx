import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import classNames from "classnames";
import { useState } from "react";

interface TicketPaginationProps {
  itemsPerPage: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  bottom?: boolean;
  className?: string;
}

export const TicketPagination: React.FC<TicketPaginationProps> = ({
  itemsPerPage,
  totalItems = 0,
  onPageChange,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = isNaN(Math.ceil(totalItems / itemsPerPage))
    ? 0
    : Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  };

  return (
    <div className={classNames("flex items-center py-4", className)}>
      <nav
        aria-label="Pagination"
        className="isolate inline-flex -space-x-px rounded-md shadow-xs"
      >
        <button
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1 || totalPages === 0}
          className="relative inline-flex items-center rounded-l-md text-gray-600 inset-ring inset-ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="sr-only">Previous</span>
          <IconChevronLeft aria-hidden="true" className="size-7" />
        </button>

        <button
          onClick={() =>
            handlePageChange(Math.min(totalPages, currentPage + 1))
          }
          disabled={currentPage === totalPages || totalPages === 0}
          className="relative inline-flex items-center rounded-r-md text-gray-600 pl-2 inset-ring inset-ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="sr-only">Next</span>
          <IconChevronRight aria-hidden="true" className="size-7" />
        </button>
      </nav>
      <p className="pl-3 text-gray-700">
        <span className="font-semibold">{startItem}</span> -{" "}
        <span className="font-semibold">{endItem}</span> of{" "}
        <span className="font-semibold">{totalItems}</span>
      </p>
    </div>
  );
};
