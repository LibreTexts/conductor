import React, { useMemo } from "react";
import { Listbox } from "@libretexts/davis-react";
import {
  ALL_OPTION,
  LIBRARY_GROUPS,
  applyListChange,
  describeSelection,
  groupOption,
  groupSelection,
  listValue,
} from "./libraryGroups";

export type LibraryChoice = {
  /** Library subdomain. */
  id: string;
  /** What the list shows for it; defaults to the subdomain. */
  label?: string;
};

type Props = {
  /** Libraries on offer, in display order. */
  libraries: LibraryChoice[];
  /** Selected library subdomains; empty means every library. */
  value: string[];
  onChange: (libraries: string[]) => void;
  name: string;
  className?: string;
};

/**
 * Picks one or more libraries. "All libraries" and the library groups (STEM,
 * Health, …) sit at the top and replace the selection when chosen; below a
 * divider, single libraries toggle.
 */
const LibraryMultiSelect: React.FC<Props> = ({ libraries, value, onChange, name, className }) => {
  const ids = useMemo(() => libraries.map((lib) => lib.id), [libraries]);
  const current = listValue(value, ids);

  return (
    <Listbox
      value={current as unknown as string}
      onChange={(next) => onChange(applyListChange(current, next as unknown as string[], ids))}
      multiple
      name={name}
      className={className ?? "w-64 max-w-full"}
    >
      <Listbox.Label>Libraries</Listbox.Label>
      <Listbox.Button displayValue={() => describeSelection(value, ids)} placeholder="All libraries" />
      <Listbox.Options>
        <div role="group" aria-label="Library groups">
          <Listbox.Option value={ALL_OPTION}>All libraries</Listbox.Option>
          {LIBRARY_GROUPS.map((group) => {
            const libs = groupSelection(group, ids);
            return (
              <Listbox.Option key={group.id} value={groupOption(group)} disabled={libs.length === 0}>
                {group.label}
                <span className="block text-xs text-neutral-600">
                  {libs.length ? libs.join(", ") : "None scanned yet"}
                </span>
              </Listbox.Option>
            );
          })}
        </div>
        <div role="group" aria-label="Libraries" className="mt-1 border-t border-neutral-200 pt-1">
          {libraries.map((lib) => (
            <Listbox.Option key={lib.id} value={lib.id}>
              {lib.label ?? lib.id}
            </Listbox.Option>
          ))}
        </div>
      </Listbox.Options>
    </Listbox>
  );
};

export default LibraryMultiSelect;
