import React, { useState } from "react";
import { Button, Checkbox, Input, Form } from "semantic-ui-react";
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
} from "@tabler/icons-react";

// Utility functions
function not<T>(a: T[], b: T[], keyExtractor: (item: T) => string) {
  const bKeys = new Set(b.map(keyExtractor));
  return a.filter((value) => !bKeys.has(keyExtractor(value)));
}

function intersection<T>(a: T[], b: T[], keyExtractor: (item: T) => string) {
  const bKeys = new Set(b.map(keyExtractor));
  return a.filter((value) => bKeys.has(keyExtractor(value)));
}

function noDuplicates<T>(a: T[], keyExtractor: (item: T) => string) {
  const seen = new Set<string>();
  return a.filter((item) => {
    const key = keyExtractor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Generic item interface with nested children support
export interface TransferListItem<T = any> {
  id: string;
  data: T;
  children?: TransferListItem<T>[];
}

interface TransferListProps<T> {
  availableItems: TransferListItem<T>[];
  setAvailableItems: (items: TransferListItem<T>[]) => void;
  selectedItems: TransferListItem<T>[];
  setSelectedItems: (items: TransferListItem<T>[]) => void;
  allowManualEntry?: boolean;
  renderItem: (item: T) => React.ReactNode;
  onManualEntry?: (input: string) => TransferListItem<T>;
  itemActions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: (item: TransferListItem<T>) => void;
  }>;
}

const TransferList = <T,>({
  availableItems,
  setAvailableItems,
  selectedItems,
  setSelectedItems,
  allowManualEntry = false,
  renderItem,
  onManualEntry,
  itemActions = [],
}: TransferListProps<T>) => {
  const [checked, setChecked] = useState<string[]>([]);
  const [expandedAvailable, setExpandedAvailable] = useState<Set<string>>(
    new Set()
  );
  const [expandedSelected, setExpandedSelected] = useState<Set<string>>(
    new Set()
  );
  const [manualEntry, setManualEntry] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Helper to get all items including nested ones
  const getAllItems = (items: TransferListItem<T>[]): TransferListItem<T>[] => {
    const result: TransferListItem<T>[] = [];
    const traverse = (items: TransferListItem<T>[]) => {
      items.forEach((item) => {
        result.push(item);
        if (item.children) {
          traverse(item.children);
        }
      });
    };
    traverse(items);
    return result;
  };

  const allAvailable = getAllItems(availableItems);
  const allSelected = getAllItems(selectedItems);
  const availableChecked = intersection(
    checked
      .map((id) => allAvailable.find((item) => item.id === id)!)
      .filter(Boolean),
    allAvailable,
    (item) => item.id
  );
  const selectedChecked = intersection(
    checked
      .map((id) => allSelected.find((item) => item.id === id)!)
      .filter(Boolean),
    allSelected,
    (item) => item.id
  );

  const handleAllSelected = () => {
    setSelectedItems(
      noDuplicates([...selectedItems, ...availableItems], (item) => item.id)
    );
    setAvailableItems([]);
    setChecked([]);
  };

  const handleCheckedRight = () => {
    setSelectedItems(
      noDuplicates([...selectedItems, ...availableChecked], (item) => item.id)
    );
    setAvailableItems(not(availableItems, availableChecked, (item) => item.id));
    setChecked(
      checked.filter((id) => !availableChecked.find((item) => item.id === id))
    );
  };

  const handleCheckedLeft = () => {
    setAvailableItems(
      noDuplicates([...availableItems, ...selectedChecked], (item) => item.id)
    );
    setSelectedItems(not(selectedItems, selectedChecked, (item) => item.id));
    setChecked(
      checked.filter((id) => !selectedChecked.find((item) => item.id === id))
    );
  };

  const handleAllAvailable = () => {
    setAvailableItems(
      noDuplicates([...availableItems, ...selectedItems], (item) => item.id)
    );
    setSelectedItems([]);
    setChecked([]);
  };

  const handleCheckItem = (id: string) => {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleExpand = (id: string, isAvailable: boolean) => {
    const setter = isAvailable ? setExpandedAvailable : setExpandedSelected;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleManualEntrySubmit = () => {
    if (manualEntry && onManualEntry) {
      const newItem = onManualEntry(manualEntry);
      setSelectedItems(
        noDuplicates([...selectedItems, newItem], (item) => item.id)
      );
      setManualEntry("");
    }
  };

  const renderTreeItem = (
    item: TransferListItem<T>,
    isAvailable: boolean,
    depth: number = 0
  ) => {
    const hasChildren = item.children && item.children.length > 0;
    const expandedSet = isAvailable ? expandedAvailable : expandedSelected;
    const isExpanded = expandedSet.has(item.id);
    const isChecked = checked.includes(item.id);

    return (
      <div key={item.id}>
        <div
          className="flex flex-row items-center p-2 hover:bg-gray-50 group relative"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpand(item.id, isAvailable)}
              className="mr-1 p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )}
            </button>
          )}
          {!hasChildren && <span className="w-5 mr-1" />}

          <Checkbox
            checked={isChecked}
            onChange={() => handleCheckItem(item.id)}
          />

          <span className="ml-2 flex-1">{renderItem(item.data)}</span>

          {itemActions.length > 0 && (
            <div className="relative">
              <button
                onClick={() =>
                  setActiveMenu(activeMenu === item.id ? null : item.id)
                }
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
              >
                <IconDotsVertical size={16} />
              </button>

              {activeMenu === item.id && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setActiveMenu(null)}
                  />
                  <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[150px]">
                    {itemActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          action.onClick(item);
                          setActiveMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {item.children!.map((child) =>
              renderTreeItem(child, isAvailable, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full mb-4">
      <div className="flex flex-row gap-4">
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-gray-700">Available Items</p>
            <span className="text-sm text-gray-500">
              {allAvailable.length} items
            </span>
          </div>
          <div className="flex flex-col border border-gray-300 rounded-lg h-96 overflow-auto bg-white shadow-sm">
            {availableItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No items available
              </div>
            ) : (
              availableItems.map((item) => renderTreeItem(item, true))
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center items-center gap-2 py-8">
          <Button
            icon="angle double right"
            onClick={handleAllSelected}
            disabled={availableItems.length === 0}
            size="small"
            title="Move all to selected"
          />
          <Button
            icon="angle right"
            onClick={handleCheckedRight}
            disabled={availableChecked.length === 0}
            size="small"
            title="Move checked to selected"
          />
          <Button
            icon="angle left"
            onClick={handleCheckedLeft}
            disabled={selectedChecked.length === 0}
            size="small"
            title="Move checked to available"
          />
          <Button
            icon="angle double left"
            onClick={handleAllAvailable}
            disabled={selectedItems.length === 0}
            size="small"
            title="Move all to available"
          />
        </div>

        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-gray-700">Selected Items</p>
            <span className="text-sm text-gray-500">
              {allSelected.length} items
            </span>
          </div>
          <div className="flex flex-col border border-gray-300 rounded-lg h-96 overflow-auto bg-white shadow-sm">
            {selectedItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No items selected
              </div>
            ) : (
              selectedItems.map((item) => renderTreeItem(item, false))
            )}
          </div>
        </div>
      </div>

      {allowManualEntry && (
        <div className="flex flex-row mt-4 justify-end">
          <div className="flex flex-col flex-1 max-w-md">
            <Form
              className="flex flex-row gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleManualEntrySubmit();
              }}
            >
              <Input
                type="text"
                className="flex-1"
                placeholder="Enter a new item"
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
              />
              <Button
                icon="plus"
                color="blue"
                onClick={handleManualEntrySubmit}
                disabled={!manualEntry}
              />
            </Form>
            <p className="text-xs text-gray-400 italic mt-1 ml-1">
              Manually added items will need to be entered again if removed and
              list is saved.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferList;
