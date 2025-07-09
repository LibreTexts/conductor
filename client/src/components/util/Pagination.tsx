import { IconArrowNarrowLeft, IconArrowNarrowRight } from "@tabler/icons-react";
import classNames from "classnames";

interface PaginationProps {
  activePage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  activePage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const pageButtons = Array.from({ length: totalPages }, (_, i) => i + 1);
  const moreThan5Pages = totalPages > 6;

  const firstSlice = pageButtons.slice(0, 3);
  const lastSlice = pageButtons.slice(-3);

  const PageButton = ({ page }: { page: number }) => (
    <button
      key={page}
      onClick={() => onPageChange(page)}
      aria-current={activePage === page ? "page" : undefined}
      className={`inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium ${
        activePage === page
          ? "text-indigo-600"
          : "text-gray-500 hover:border-gray-300 hover:text-gray-700"
      }`}
    >
      {page}
    </button>
  );

  return (
    <nav className={classNames("flex items-center justify-between border-t border-gray-200 px-4 sm:px-0", className)}>
      <div className="-mt-px flex w-0 flex-1">
        <button
          onClick={() => onPageChange(activePage - 1)}
          disabled={activePage === 1}
          className="inline-flex items-center border-t-2 border-transparent pr-1 pt-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
        >
          <IconArrowNarrowLeft
            aria-hidden="true"
            className="mr-3 h-5 w-5 text-gray-400"
          />
          Previous
        </button>
      </div>
      <div className="hidden md:-mt-px md:flex">
        {moreThan5Pages ? (
          <>
            {firstSlice.map((page) => (
              <PageButton page={page} />
            ))}
            <span className="inline-flex items-center border-t-2 border-transparent px-4 pt-4 text-sm font-medium text-gray-500">
              ...
            </span>
            {lastSlice.map((page) => (
              <PageButton page={page} />
            ))}
          </>
        ) : (
          pageButtons.map((page) => <PageButton page={page} />)
        )}
      </div>
      <div className="-mt-px flex w-0 flex-1 justify-end">
        <button
          onClick={() => onPageChange(activePage + 1)}
          disabled={activePage === totalPages}
          className="inline-flex items-center border-t-2 border-transparent pl-1 pt-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
        >
          Next
          <IconArrowNarrowRight
            aria-hidden="true"
            className="ml-3 h-5 w-5 text-gray-400"
          />
        </button>
      </div>
    </nav>
  );
}
