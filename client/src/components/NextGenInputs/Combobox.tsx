import {
  Combobox as HeadlessCombobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
} from "@headlessui/react";
import { IconChevronDown, IconLoader2 } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { GenericKeyTextValueObj } from "../../types";
import classNames from "classnames";

export type ComboboxProps = {
  name: string;
  label: string;
  required?: boolean;
  error?: boolean;
  items: GenericKeyTextValueObj<string>[];
  loading?: boolean;
  placeholder?: string;
  value?: string | string[];
} & (
  | {
      multiple?: true;
      onChange: (value: string[]) => void;
    }
  | {
      multiple?: false;
      onChange: (value: string) => void;
    }
);

const Combobox: React.FC<ComboboxProps> = ({
  label,
  required,
  items,
  multiple = false,
  loading = false,
  value,
  placeholder = "Select...",
  ...props
}) => {
  const [query, setQuery] = useState("");

  const selectedItems = useMemo(() => {
    if (value === undefined || value === "") {
      return [];
    }

    if (multiple && Array.isArray(value)) {
      return items.filter((item) => value.includes(item.value));
    } else if (!multiple && typeof value === "string") {
      const selectedItem = items.find((item) => item.value === value);
      return selectedItem ? [selectedItem] : [];
    }
    return [];
  }, [value, items, multiple]);

  const filteredItems =
    query === ""
      ? items
      : items.filter((item) => {
          return (
            item.value.toLowerCase().includes(query.toLowerCase()) ||
            item.text.toLowerCase().includes(query.toLowerCase())
          );
        });

  const isSelected = (item: GenericKeyTextValueObj<string>) => {
    if (multiple) {
      return selectedItems.some((i) => i.value === item.value);
    } else {
      return selectedItems.length > 0 && selectedItems[0].value === item.value;
    }
  };

  return (
    <HeadlessCombobox
      as="div"
      {...props}
      value={(multiple ? selectedItems : selectedItems[0]) as any}
      multiple={multiple}
      onChange={(item) => {
        if (multiple) {
          // if item is an empty array, clear all selections
          if (Array.isArray(item) && item.length === 0) {
            (props.onChange as (value: string[]) => void)([]);
            return;
          }

          const lastAddedItem = item[item.length - 1];
          const alreadyExists = selectedItems.some(
            (i) => i.value === lastAddedItem.value
          );

          const newValues = alreadyExists
            ? selectedItems
                .filter((i) => i.value !== lastAddedItem.value)
                .map((i) => i.value)
            : [...selectedItems, lastAddedItem].map((i) => i.value);

          (props.onChange as (value: string[]) => void)(newValues);
        } else {
          // if item is the same as the currently selected item, deselect it
          const newValue =
            selectedItems.length > 0 &&
            selectedItems[0].value ===
              (item as GenericKeyTextValueObj<string>).value
              ? ""
              : (item as GenericKeyTextValueObj<string>).value;
          (props.onChange as (value: string) => void)(newValue);
        }
      }}
      immediate
    >
      {label && (
        <Label className="block text-sm/6 font-medium text-gray-900">
          {label}
          {required ? "*" : ""}
        </Label>
      )}
      <div className="relative mt-2">
        <ComboboxInput
          disabled={loading}
          className={classNames(
            "block w-full rounded-md bg-white py-2 px-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6",
            props.error ? "outline-red-500 focus:outline-red-500" : "",
            loading ? "opacity-85 cursor-not-allowed" : ""
          )}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => setQuery("")}
          placeholder={placeholder}
          displayValue={(item) => {
            if (Array.isArray(item)) {
              return item.map((i) => i.text).join(", ");
            }
            return item ? (item as any).text : "";
          }}
        />
        <ComboboxButton
          className={classNames(
            "absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-hidden"
          )}
          disabled={loading}
        >
          {loading ? (
            <IconLoader2
              className="size-5 text-gray-400 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <IconChevronDown
              className="size-5 text-gray-400"
              aria-hidden="true"
            />
          )}
        </ComboboxButton>

        <ComboboxOptions
          transition
          className="absolute !z-30 mt-1 max-h-60 w-full cursor-pointer overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline outline-black/5 data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 sm:text-sm"
        >
          {filteredItems.map((item) => (
            <ComboboxOption
              key={item.key}
              value={item}
              className={classNames(
                "cursor-pointer px-3 py-2 text-gray-900 select-none data-focus:text-white data-focus:outline-hidden",
                isSelected(item) ? "bg-gray-200" : "hover:bg-gray-50"
              )}
            >
              <span className="block truncate">{item.text}</span>
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </div>
    </HeadlessCombobox>
  );
};

export default Combobox;
