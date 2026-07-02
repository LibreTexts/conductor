import { useEffect, useMemo, useState } from "react";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import { useSearchParams } from "react-router-dom-v5-compat";
import useGlobalError from "../../../components/error/ErrorHooks";
import { formatPrice } from "../../../utils/storeHelpers";
import TruncatedText from "../../../components/util/TruncatedText";
import { usePaginatedStoreProducts } from "../../../hooks/usePaginatedStoreProducts";
import {
  Accordion,
  Button,
  Card,
  Checkbox,
  Drawer,
  EmptyState,
  Heading,
  IconButton,
  Spinner,
  Text,
} from "@libretexts/davis-react";
import { IconFilter, IconPackageOff } from "@tabler/icons-react";

const initFilters = [
  {
    id: "category",
    name: "Category",
    options: [
      { value: "all", label: "All Categories", checked: true },
      { value: "academy", label: "Academy Courses", checked: false },
      {
        value: "access-codes",
        label: "Application Access Codes",
        checked: false,
      },
      { value: "books", label: "Books", checked: false },
    ],
  },
];

type CatalogFilters = typeof initFilters;

function CategoryFilters({
  filters,
  onUpdateFilter,
}: {
  filters: CatalogFilters;
  onUpdateFilter: (
    filterId: string,
    optionValue: string,
    isChecked: boolean
  ) => void;
}) {
  return (
    <Accordion variant="bordered">
      {filters.map((section) => (
        <Accordion.Item key={section.id} defaultOpen>
          <Accordion.Trigger>{section.name}</Accordion.Trigger>
          <Accordion.Panel>
            <div className="flex flex-col gap-3">
              {section.options.map((option) => (
                <Checkbox
                  key={option.value}
                  name={`${section.id}-${option.value}`}
                  label={option.label}
                  checked={option.checked}
                  onChange={(checked) =>
                    onUpdateFilter(section.id, option.value, checked)
                  }
                />
              ))}
            </div>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

export default function CatalogPage() {
  const { handleGlobalError } = useGlobalError();
  const [searchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(initFilters);
  const selectedCategory = useMemo(() => {
    // find first "category" filter that has a checked option
    const categoryFilter = filters.find((section) => section.id === "category");
    return (
      categoryFilter?.options.find((option) => option.checked)?.value || ""
    );
  }, [filters]);

  const searchQuery = searchParams.get("query");

  const { data, isFetching, hasMore, loadMore } = usePaginatedStoreProducts({
    category: selectedCategory,
    itemsPerPage: 48,
    searchQuery: searchQuery || undefined,
  });

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    const category = params.category ? params.category : "";
    if (category) {
      handleUpdateFilter("category", category, true);
    }
  }, [searchParams]);

  useEffect(() => {
    handleUpdateSearchParams({ category: selectedCategory });
  }, [selectedCategory]);

  function handleUpdateSearchParams(newFilters: Record<string, string>) {
    const newParams = new URLSearchParams();

    // Keep existing search query
    if (searchQuery) {
      newParams.set("query", searchQuery);
    }

    Object.entries(newFilters).forEach(([key, value]) => {
      if (key === "category" && value === "all") {
        newParams.delete("category");
        return; // Skip adding "all" category to params
      }
      if (value) {
        newParams.set(key, value);
      }
    });

    // Update the URL with the new search params
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ""}`
    );
  }

  function handleUpdateFilter(
    filterId: string,
    optionValue: string,
    isChecked: boolean
  ) {
    // Update the selected category based on the filter
    if (filterId === "category") {
      // when a new category is selected, clear any other "checked" categories
      const updatedFilters = filters.map((section) => {
        if (section.id === filterId) {
          return {
            ...section,
            options: section.options.map((option) => ({
              ...option,
              checked: option.value === optionValue ? isChecked : false,
            })),
          };
        }
        return section;
      });

      setFilters(updatedFilters);
      handleUpdateSearchParams({ category: isChecked ? optionValue : "" });
    }
  }

  return (
    <AlternateLayout>
      {/* Mobile filter drawer */}
      <Drawer
        open={mobileFiltersOpen}
        onClose={setMobileFiltersOpen}
        side="right"
        size="sm"
      >
        <Drawer.Header>
          <Drawer.Title>Filters</Drawer.Title>
          <Drawer.Close />
        </Drawer.Header>
        <Drawer.Body>
          <CategoryFilters filters={filters} onUpdateFilter={handleUpdateFilter} />
        </Drawer.Body>
      </Drawer>

      <main className="px-24">
        <div className="flex items-baseline justify-between border-b border-gray-200 pb-6 pt-12">
          <Heading level={1}>All Items</Heading>

          <div className="flex items-center">
            <IconButton
              aria-label="Open filters"
              variant="ghost"
              icon={<IconFilter size={20} />}
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden"
            />
          </div>
        </div>

        <section aria-labelledby="products-heading" className="pb-24 pt-6">
          <h2 id="products-heading" className="sr-only">
            Products
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
            {/* Filters */}
            <div className="hidden lg:block">
              <CategoryFilters filters={filters} onUpdateFilter={handleUpdateFilter} />
            </div>

            {/* Product grid */}
            <div className="flex flex-col lg:col-span-3">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {isFetching && data.length === 0 && (
                  <div className="col-span-full flex justify-center py-16">
                    <Spinner size="lg" text="Loading products..." />
                  </div>
                )}
                {!isFetching && data.length === 0 && (
                  <EmptyState
                    className="col-span-full"
                    icon={<IconPackageOff size={40} />}
                    title="No products found"
                    description="Try adjusting your filters or search criteria."
                  />
                )}
                {data.map((product) => (
                  <Card
                    key={product.id}
                    variant="outline"
                    padding="none"
                    href={`/store/product/${product.id}`}
                    className="flex flex-col overflow-hidden text-left transition-shadow hover:shadow-md"
                  >
                    <div className="flex justify-center bg-white p-6">
                      <img
                        alt={`Image of ${product.name}`}
                        src={product.images[0]}
                        className="h-48 w-full object-contain"
                      />
                    </div>
                    <Card.Body className="flex grow flex-col px-6 pb-6">
                      <Heading level={3} className="!text-lg">
                        {product.name}
                      </Heading>
                      <Text size="sm" color="muted" className="mt-1">
                        {product.metadata?.book_id
                          ? product.metadata?.book_author || "Unknown"
                          : "LibreTexts"}
                      </Text>
                      <TruncatedText
                        text={product.description}
                        maxLines={3}
                        preciseTruncation={true}
                        className="mt-2 h-20 text-xs text-gray-500"
                      />
                      <Text weight="semibold" size="lg" className="mt-4">
                        {formatPrice(product.prices[0].unit_amount, true)}
                      </Text>
                    </Card.Body>
                  </Card>
                ))}
              </div>
              {hasMore && (
                <div className="mt-12 flex w-full flex-col items-center justify-center">
                  <Button
                    variant="primary"
                    onClick={() => loadMore?.()}
                    disabled={isFetching}
                    loading={isFetching}
                  >
                    {isFetching ? "Loading..." : "Load More"}
                  </Button>
                  <Text size="sm" color="muted" className="mt-4">
                    Showing {data?.length || 0} items
                  </Text>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </AlternateLayout>
  );
}
