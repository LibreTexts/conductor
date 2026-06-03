import React, { useState } from "react";
import { Button, Checkbox, Input } from "@libretexts/davis-react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconPlus,
} from "@tabler/icons-react";

function not(a: string[], b: string[]) {
  return a.filter((value) => b.indexOf(value) === -1);
}

function intersection(a: string[], b: string[]) {
  return a.filter((value) => b.indexOf(value) !== -1);
}

function sort(a: string[]) {
  return a.sort((a, b) => a.localeCompare(b));
}

function noDuplicates(a: string[]) {
  return Array.from(new Set(a));
}

interface TransferListProps {
  availableItems: string[];
  setAvailableItems: (items: string[]) => void;
  selectedItems: string[];
  setSelectedItems: (items: string[]) => void;
  allowManualEntry?: boolean;
}

const TransferList: React.FC<TransferListProps> = ({
  availableItems,
  setAvailableItems,
  selectedItems,
  setSelectedItems,
  allowManualEntry,
}) => {
  const [checked, setChecked] = useState<string[]>([]);
  const availableChecked = intersection(checked, availableItems);
  const selectedChecked = intersection(checked, selectedItems);
  const [manualEntry, setManualEntry] = useState("");

  const handleAllSelected = () => {
    setSelectedItems(noDuplicates(sort(selectedItems.concat(availableItems))));
    setAvailableItems([]);
  };

  const handleCheckedRight = () => {
    setSelectedItems(noDuplicates(sort(selectedItems.concat(availableChecked))));
    setAvailableItems(noDuplicates(sort(not(availableItems, availableChecked))));
    setChecked(noDuplicates(not(checked, availableChecked)));
  };

  const handleCheckedLeft = () => {
    setAvailableItems(noDuplicates(sort(availableItems.concat(selectedChecked))));
    setSelectedItems(noDuplicates(sort(not(selectedItems, selectedChecked))));
    setChecked(noDuplicates(sort(not(checked, selectedChecked))));
  };

  const handleAllAvailable = () => {
    setAvailableItems(noDuplicates(sort(availableItems.concat(selectedItems))));
    setSelectedItems([]);
  };

  const handleCheckItem = (value: string) => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];
    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }
    setChecked(sort(newChecked));
  };

  const handleManualEntry = () => {
    if (manualEntry) {
      setSelectedItems(noDuplicates(sort(selectedItems.concat(manualEntry))));
      setManualEntry("");
    }
  };

  return (
    <div className="flex flex-col w-full h-96 mb-4">
      <div className="flex flex-row">
        <div className="flex flex-col basis-2/5">
          <p className="font-bold">Available Items</p>
          <div className="flex flex-col border rounded-md min-h-48 h-72 overflow-auto mt-0.5">
            {availableItems.map((item) => (
              <div key={item} className="flex flex-row items-center p-2">
                <Checkbox
                  name={`available-${item}`}
                  label={item}
                  checked={checked.indexOf(item) !== -1}
                  onChange={() => handleCheckItem(item)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col h-full justify-center basis-1/5 items-center gap-3">
          <Button
            variant="secondary"
            icon={<IconChevronsRight size={16} />}
            onClick={handleAllSelected}
            aria-label="Move all to selected"
            size="sm"
          />
          <Button
            variant="secondary"
            icon={<IconChevronRight size={16} />}
            onClick={handleCheckedRight}
            disabled={availableChecked.length === 0}
            aria-label="Move checked to selected"
            size="sm"
          />
          <Button
            variant="secondary"
            icon={<IconChevronLeft size={16} />}
            onClick={handleCheckedLeft}
            disabled={selectedChecked.length === 0}
            aria-label="Move checked to available"
            size="sm"
          />
          <Button
            variant="secondary"
            icon={<IconChevronsLeft size={16} />}
            onClick={handleAllAvailable}
            aria-label="Move all to available"
            size="sm"
          />
        </div>

        <div className="flex flex-col basis-2/5">
          <p className="font-bold">Selected Items</p>
          <div className="flex flex-col border rounded-md h-72 overflow-auto mt-0.5">
            {selectedItems.map((item) => (
              <div key={item} className="flex flex-row items-center p-2">
                <Checkbox
                  name={`selected-${item}`}
                  label={item}
                  checked={checked.indexOf(item) !== -1}
                  onChange={() => handleCheckItem(item)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {allowManualEntry && (
        <div className="flex flex-row mt-2 justify-end">
          <div className="flex flex-col basis-2/5">
            <form
              className="flex flex-row gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleManualEntry();
              }}
            >
              <Input
                name="manual-entry"
                label=""
                aria-label="Enter a new item"
                placeholder="Enter a new item"
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="primary"
                icon={<IconPlus size={16} />}
                onClick={handleManualEntry}
                aria-label="Add item"
              />
            </form>
            <p className="text-sm text-gray-400 italic ml-1">
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
