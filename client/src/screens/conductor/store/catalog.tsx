import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import AlternateLayout from "../../../components/navigation/AlternateLayout";
import classNames from "classnames";
import { Icon } from "semantic-ui-react";
import ProductCard from "../../../components/store/ProductCard";
import { useSearchParams } from "react-router-dom-v5-compat";
import { DEMO_PRODUCTS } from "./demo-data";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import { StoreProduct } from "../../../types";
import useGlobalError from "../../../components/error/ErrorHooks";
import { formatPrice } from "../../../utils/storeHelpers";
import TruncatedText from "../../../components/util/TruncatedText";

// const sortOptions = [
//   { name: "Most Popular", href: "#", current: true },
//   { name: "Best Rating", href: "#", current: false },
//   { name: "Newest", href: "#", current: false },
//   { name: "Price: Low to High", href: "#", current: false },
//   { name: "Price: High to Low", href: "#", current: false },
// ];
const initialFilters = [
  {
    id: "category",
    name: "Category",
    options: [
      { value: "academy", label: "Academy Courses", checked: false },
      {
        value: "access-codes",
        label: "Application Access Codes",
        checked: false,
      },
      { value: "books", label: "Books", checked: true },
    ],
  },
];

export default function CatalogPage() {
  const { handleGlobalError } = useGlobalError();
  const [searchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(initialFilters);

  const { data, isFetching } = useQuery<StoreProduct[]>({
    queryKey: ["store-products", filters],
    queryFn: fetchProducts,
  });

  async function fetchProducts() {
    try {
      const products = await api.getStoreProducts({
        limit: 100,
        category: filters
          .find((f) => f.id === "category")
          ?.options.filter((o) => o.checked)
          .map((o) => o.value)
          .join(","),
        query: searchParams.get("query") || undefined,
      });

      if (products.data.err) {
        throw new Error(products.data.errMsg);
      }

      if (!products.data) {
        throw new Error("Invalid response from server.");
      }

      return products.data.products;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    // You can use params to filter products or perform other actions
    console.log("Query Parameters:", params);
    const categories = params.category ? params.category.split(",") : [];
    const subjects = params.subject ? params.subject.split(",") : [];

    // Update filters based on search params
    const updatedFilters = initialFilters.map((filter) => {
      if (filter.id === "category") {
        return {
          ...filter,
          options: filter.options.map((option) => ({
            ...option,
            checked: categories.includes(option.value),
          })),
        };
      }
      if (filter.id === "subject") {
        return {
          ...filter,
          options: filter.options.map((option) => ({
            ...option,
            checked: subjects.includes(option.value),
          })),
        };
      }
      return filter;
    });

    setFilters(updatedFilters);
  }, [searchParams]);

  const displayProducts = useMemo(() => {
    const results = DEMO_PRODUCTS.filter((product) => {
      const categoryFilter = filters.find((f) => f.id === "category");
      console.log("Category Filter:", categoryFilter);
      const subjectFilter = filters.find((f) => f.id === "subject");
      console.log("Subject Filter:", subjectFilter);
      if (!categoryFilter) return true;

      const categoryMatch = categoryFilter.options.some(
        (option) =>
          option.checked &&
          product.category.toLowerCase().includes(option.value)
      );

      // const subjectMatch =
      //   !subjectFilter ||
      //   subjectFilter.options.some(
      //     (option) =>
      //       option.checked &&
      //       product.subtitle.toLowerCase().includes(option.value)
      //   );

      // if (categoryFilter && subjectFilter) {
      //   return categoryMatch && subjectMatch;
      // }
      return categoryMatch;
    });
    console.log("Filtered Products:", results);
    return results;
  }, [filters, DEMO_PRODUCTS]);

  function handleUpdateFilters(
    sectionId: string,
    optionValue: string,
    checked: boolean
  ) {
    const updatedFilters = filters.map((section) => {
      if (section.id === sectionId) {
        return {
          ...section,
          options: section.options.map((option) =>
            option.value === optionValue ? { ...option, checked } : option
          ),
        };
      }
      return section;
    });
    setFilters(updatedFilters);
    handleUpdateSearchParams(updatedFilters);
  }

  function handleUpdateSearchParams(newFilters: typeof filters = filters) {
    const newParams = new URLSearchParams();
    newFilters.forEach((section) => {
      let optionsString = "";
      section.options.forEach((option) => {
        if (option.checked) {
          optionsString += `,${option.value}`;
        }
      });
      if (optionsString) {
        newParams.append(section.id, optionsString);
      }
    });

    // Update the URL with the new search params
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${newParams.toString()}`
    );
  }

  return (
    <AlternateLayout>
      {/* Mobile filter dialog */}
      <Dialog
        open={mobileFiltersOpen}
        onClose={setMobileFiltersOpen}
        className="relative z-40 lg:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/25 transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
        />

        <div className="fixed inset-0 z-40 flex">
          <DialogPanel
            transition
            className="relative ml-auto flex size-full max-w-xs transform flex-col overflow-y-auto bg-white py-4 pb-12 shadow-xl transition duration-300 ease-in-out data-[closed]:translate-x-full"
          >
            <div className="flex items-center justify-between px-4">
              <h2 className="text-lg font-medium text-gray-900">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="relative -mr-2 flex size-10 items-center justify-center rounded-md bg-white p-2 text-gray-400"
              >
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Close menu</span>
                <Icon name="x" className="size-6" aria-hidden="true" />
              </button>
            </div>

            {/* Filters */}
            <form className="mt-4 border-t border-gray-200">
              {filters.map((section) => (
                <Disclosure
                  key={section.id}
                  as="div"
                  className="border-t border-gray-200 px-4 py-6"
                  defaultOpen={true}
                >
                  <h3 className="-mx-2 -my-3 flow-root">
                    <DisclosureButton className="group flex w-full items-center justify-between bg-white px-2 py-3 text-gray-400 hover:text-gray-500">
                      <span className="font-medium text-gray-900">
                        {section.name}
                      </span>
                      <span className="ml-6 flex items-center">
                        <Icon
                          name="plus"
                          aria-hidden="true"
                          className="size-5 group-data-[open]:hidden"
                        />
                        <Icon
                          name="minus"
                          aria-hidden="true"
                          className="size-5 group-[&:not([data-open])]:hidden"
                        />
                      </span>
                    </DisclosureButton>
                  </h3>
                  <DisclosurePanel className="pt-6">
                    <div className="space-y-6">
                      {section.options.map((option, optionIdx) => (
                        <div key={option.value} className="flex gap-3">
                          <div className="flex h-5 shrink-0 items-center">
                            <div className="group grid size-4 grid-cols-1">
                              <input
                                defaultValue={option.value}
                                defaultChecked={option.checked}
                                id={`filter-mobile-${section.id}-${optionIdx}`}
                                name={`${section.id}[]`}
                                type="checkbox"
                                onClick={(e) => {
                                  const isChecked = e.currentTarget.checked;
                                  handleUpdateFilters(
                                    section.id,
                                    option.value,
                                    isChecked
                                  );
                                }}
                                className="col-start-1 row-start-1 appearance-none rounded border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                              />
                              <svg
                                fill="none"
                                viewBox="0 0 14 14"
                                className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                              >
                                <path
                                  d="M3 8L6 11L11 3.5"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="opacity-0 group-has-[:checked]:opacity-100"
                                />
                                <path
                                  d="M3 7H11"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="opacity-0 group-has-[:indeterminate]:opacity-100"
                                />
                              </svg>
                            </div>
                          </div>
                          <label
                            htmlFor={`filter-mobile-${section.id}-${optionIdx}`}
                            className="min-w-0 flex-1 text-gray-500"
                          >
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </DisclosurePanel>
                </Disclosure>
              ))}
            </form>
          </DialogPanel>
        </div>
      </Dialog>

      <main className="px-24">
        <div className="flex items-baseline justify-between border-b border-gray-200 pb-6 pt-12">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            All Items
          </h1>

          <div className="flex items-center">
            <Menu as="div" className="relative inline-block text-left">
              {/* <div>
                <MenuButton className="group inline-flex justify-center text-sm font-medium text-gray-700 hover:text-gray-900">
                  Sort
                  <Icon
                    name="chevron down"
                    aria-hidden="true"
                    className="ml-1 size-5 text-gray-400 group-hover:text-gray-500"
                  />
                </MenuButton>
              </div> */}

              {/* <MenuItems
                transition
                className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white shadow-2xl ring-1 ring-black/5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
              >
                <div className="py-1">
                  {sortOptions.map((option) => (
                    <MenuItem key={option.name}>
                      <a
                        href={option.href}
                        className={classNames(
                          option.current
                            ? "font-medium text-gray-900"
                            : "text-gray-500",
                          "block px-4 py-2 text-sm data-[focus]:bg-gray-100 data-[focus]:outline-none"
                        )}
                      >
                        {option.name}
                      </a>
                    </MenuItem>
                  ))}
                </div>
              </MenuItems> */}
            </Menu>

            {/* <button
              type="button"
              className="-m-2 ml-5 p-2 text-gray-400 hover:text-gray-500 sm:ml-7"
            >
              <span className="sr-only">View grid</span>
              <Icon name="grid layout" aria-hidden="true" className="size-5" />
            </button> */}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="-m-2 ml-4 p-2 text-gray-400 hover:text-gray-500 sm:ml-6 lg:hidden"
            >
              <span className="sr-only">Filters</span>
              <Icon name="filter" aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>

        <section aria-labelledby="products-heading" className="pb-24 pt-6">
          <h2 id="products-heading" className="sr-only">
            Products
          </h2>

          <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">
            {/* Filters */}
            <form className="hidden lg:block">
              {filters.map((section) => (
                <Disclosure
                  key={section.id}
                  as="div"
                  className="border-b border-gray-200 py-6"
                >
                  <h3 className="-my-3 flow-root">
                    <DisclosureButton className="group flex w-full items-center justify-between bg-white py-3 text-sm text-gray-400 hover:text-gray-500">
                      <span className="font-medium text-gray-900">
                        {section.name}
                      </span>
                      <span className="ml-6 flex items-center">
                        <Icon
                          name="plus"
                          aria-hidden="true"
                          className="size-5 group-data-[open]:hidden"
                        />
                        <Icon
                          name="minus"
                          aria-hidden="true"
                          className="size-5 group-[&:not([data-open])]:hidden"
                        />
                      </span>
                    </DisclosureButton>
                  </h3>
                  <DisclosurePanel className="pt-6">
                    <div className="space-y-4">
                      {section.options.map((option, optionIdx) => (
                        <div key={option.value} className="flex gap-3">
                          <div className="flex h-5 shrink-0 items-center">
                            <div className="group grid size-4 grid-cols-1">
                              <input
                                defaultValue={option.value}
                                defaultChecked={option.checked}
                                id={`filter-${section.id}-${optionIdx}`}
                                name={`${section.id}[]`}
                                type="checkbox"
                                onClick={(e) => {
                                  const isChecked = e.currentTarget.checked;
                                  handleUpdateFilters(
                                    section.id,
                                    option.value,
                                    isChecked
                                  );
                                }}
                                className="col-start-1 row-start-1 appearance-none rounded border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
                              />
                              <svg
                                fill="none"
                                viewBox="0 0 14 14"
                                className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                              >
                                <path
                                  d="M3 8L6 11L11 3.5"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="opacity-0 group-has-[:checked]:opacity-100"
                                />
                                <path
                                  d="M3 7H11"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="opacity-0 group-has-[:indeterminate]:opacity-100"
                                />
                              </svg>
                            </div>
                          </div>
                          <label
                            htmlFor={`filter-${section.id}-${optionIdx}`}
                            className="text-sm text-gray-600"
                          >
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </DisclosurePanel>
                </Disclosure>
              ))}
            </form>

            {/* Product grid */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-3 lg:col-span-3 lg:gap-x-8">
              {!isFetching && data?.length === 0 && (
                <div className="col-span-3 text-center">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    No products found
                  </h2>
                  <p className="mt-2 text-gray-500">
                    Try adjusting your filters or search criteria.
                  </p>
                </div>
              )}
              {data?.map((product) => (
                <div
                  key={product.id}
                  className="inline-flex w-64 flex-col text-center lg:w-auto border rounded-md p-6 shadow-sm"
                >
                  <div className="group relative">
                    <div className="flex justify-center">
                      <img
                        alt={`Image of ${product.name}`}
                        src={product.images[0]}
                        className="aspect-auto h-60 w-fit rounded-md bg-gray-white object-contain group-hover:opacity-75"
                      />
                    </div>
                    <div className="mt-6">
                      <h3 className="mt-1 text-xl font-semibold text-gray-900">
                        <a href={`/store/product/${product.id}`}>
                          <span className="absolute inset-0" />
                          {product.name}
                        </a>
                      </h3>
                      <TruncatedText
                        text={product.description}
                        maxLines={3}
                        preciseTruncation={true}
                        className="mt-2 text-sm text-gray-500 h-20"
                      />
                      <p className="mt-4 text-xl text-gray-900 font-semibold">
                        {formatPrice(product.prices[0].unit_amount, true)}
                      </p>
                    </div>
                  </div>

                  {/* <h4 className="sr-only">Available colors</h4>
                      <ul
                        role="list"
                        className="mt-auto flex items-center justify-center space-x-3 pt-6"
                      >
                        {product.availableColors.map((color) => (
                          <li
                            key={color.name}
                            style={{ backgroundColor: color.colorBg }}
                            className="size-4 rounded-full border border-black/10"
                          >
                            <span className="sr-only">{color.name}</span>
                          </li>
                        ))}
                      </ul> */}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AlternateLayout>
  );
}
