import { Button, Spinner } from "@libretexts/davis-react";
import { IconBan, IconDownload, IconSettings, IconCheck } from "@tabler/icons-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  OrgEvent,
  OrgEventParticipant,
  OrgEventParticipantFormResponse,
} from "../../../types";
import { isEmptyString } from "../../util/HelperFunctions";
import { getLikertResponseText } from "../../util/LikertHelpers";
import PaymentStatusLabel from "./PaymentStatusLabel";
import UnregisterParticipantsModal from "./UnregisterParticipantsModal";
import AutoSyncToProjectModal from "./AutoSyncToProjectModal";

type SelectableParticipant = OrgEventParticipant & {
  selected: boolean;
};

type ParticipantsSegmentProps = {
  show: boolean;
  toggleVisibility: () => void;
  orgEvent: OrgEvent;
  participants: OrgEventParticipant[];
  loading: boolean;
  canEdit: boolean;
  autoSyncSuccess: boolean;
  activePage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onDownloadParticipants: () => void;
  onChangeActivePage: (page: number) => void;
  onUnregisterParticipants: (ids: string[]) => void;
  onConfigureAutoSync: (projectID: string) => void;
};

const ParticipantsSegment: React.FC<ParticipantsSegmentProps> = ({
  show,
  toggleVisibility,
  orgEvent,
  participants,
  loading,
  canEdit,
  autoSyncSuccess,
  activePage,
  totalPages,
  totalItems,
  itemsPerPage,
  onDownloadParticipants,
  onChangeActivePage,
  onUnregisterParticipants,
  onConfigureAutoSync,
}) => {
  const [tableColumns, setTableColumns] = useState<{ key: number; text: string }[]>([]);
  const [showUnregisterModal, setShowUnregisterModal] = useState(false);
  const [showSyncProjectModal, setShowSyncProjectModal] = useState(false);
  const [selectableParticipants, setSelectableParticipants] = useState<SelectableParticipant[]>([]);
  const [allSelected, setAllSelected] = useState<boolean>(false);

  useEffect(() => {
    if (!orgEvent || !orgEvent.prompts) return;
    setTableColumns([
      ...orgEvent.prompts.map((p) => ({ key: p.order, text: p.promptText })),
    ]);
  }, [orgEvent]);

  useEffect(() => {
    if (!participants) return;
    setSelectableParticipants(
      participants.map((p) => ({ ...p, selected: false }))
    );
  }, [participants]);

  const selectedParticipantsCount: number = useMemo(
    () => selectableParticipants.filter((p) => p.selected).length,
    [selectableParticipants]
  );

  const selectedParticipants: OrgEventParticipant[] = useMemo(
    () => selectableParticipants.filter((p) => p.selected),
    [selectableParticipants]
  );

  function resetSelectedParticipants() {
    setAllSelected(false);
    setSelectableParticipants(
      [...selectableParticipants].map((p) => ({ ...p, selected: false }))
    );
  }

  function getResponseValText(promptOrder: number, responses: OrgEventParticipantFormResponse[]): string {
    const foundPrompt = orgEvent?.prompts.find((p) => p.order === promptOrder);
    if (!foundPrompt) return "";
    const foundResponse = responses.find((r) => r.promptNum === foundPrompt.order);
    if (!foundResponse) return "";

    if (["3-likert", "5-likert", "7-likert"].includes(foundPrompt.promptType)) {
      return getLikertResponseText(foundPrompt.promptType, parseInt(foundResponse.responseVal ?? ""));
    }

    if (foundPrompt.promptType === "text" && foundResponse.responseVal) {
      return foundResponse.responseVal;
    } else if (foundPrompt.promptType === "text") {
      return "(No Response)";
    }

    if (foundPrompt.promptType === "dropdown" && foundResponse.responseVal) {
      const foundPromptOption = foundPrompt.promptOptions?.find((o) => o.value === foundResponse.responseVal);
      if (foundPromptOption) return foundPromptOption.text;
    } else if (foundPrompt.promptType === "dropdown") {
      return "(No Response)";
    }

    if (foundPrompt.promptType === "checkbox") {
      return foundResponse.responseVal === "true" ? "Yes" : "No";
    }

    return "UNKNOWN VALUE";
  }

  function handleOpenUnregisterModal() {
    if (selectedParticipantsCount === 0) return;
    setShowUnregisterModal(true);
  }

  function handleUnregisterParticipants() {
    if (selectedParticipantsCount === 0) {
      setShowUnregisterModal(false);
      return;
    }
    onUnregisterParticipants(selectedParticipants.map((p) => p.regID));
    resetSelectedParticipants();
    setShowUnregisterModal(false);
  }

  function handleCheckbox(participant: SelectableParticipant, checked = false) {
    if (!participant) return;
    const foundIndex = selectableParticipants.findIndex((p) => p.regID === participant.regID);
    if (foundIndex === -1) return;
    const arr = [...selectableParticipants];
    arr.splice(foundIndex, 1, { ...selectableParticipants[foundIndex], selected: checked });
    setSelectableParticipants(arr);
    if (!checked) setAllSelected(false);
  }

  function handleSelectAllCheckbox(checked = false) {
    setAllSelected(checked);
    setSelectableParticipants([...selectableParticipants].map((p) => ({ ...p, selected: checked })));
  }

  function handleConfigureAutoSync(projectID: string) {
    onConfigureAutoSync(projectID);
    setShowSyncProjectModal(false);
  }

  if (!show) {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 m-0">Participants</h2>
          <Button variant="outline" onClick={toggleVisibility}>Show</Button>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
          {loading ? <Spinner /> : <span>Collapsed for brevity... Click "Show" to view</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800 m-0">Participants</h2>
        <Button variant="outline" onClick={toggleVisibility}>Hide</Button>
      </div>

      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          {autoSyncSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm">
              <IconCheck size={16} />
              <span>Auto-Sync Configured Successfully</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            icon={<IconBan size={16} />}
            disabled={selectedParticipantsCount === 0}
            onClick={handleOpenUnregisterModal}
          >
            Unregister
          </Button>
          <Button
            variant="secondary"
            icon={<IconSettings size={16} />}
            onClick={() => setShowSyncProjectModal(true)}
          >
            Configure Auto-Sync to Project
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    id="select-all-checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAllCheckbox(e.target.checked)}
                    className="accent-primary"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">First Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Last Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Email Address</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Payment Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Registered By</th>
                {orgEvent.collectShipping && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Shipping Address</th>
                )}
                {tableColumns.map((item) => (
                  <th key={item.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                    {item.text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {selectableParticipants && selectableParticipants.length > 0 ? (
                selectableParticipants.map((item) => (
                  <tr key={item.user?.uuid ?? item.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        id={`participant-${item.user?.uuid ?? item.email}-checkbox`}
                        checked={item.selected}
                        onChange={(e) => handleCheckbox(item, e.target.checked)}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.user?.firstName ?? item.firstName ?? "Unknown"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.user?.lastName ?? item.lastName ?? "Unknown"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.user?.email ?? item.email ?? "Unknown"}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusLabel paymentStatus={item.paymentStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.registeredBy?.uuid === item.user?.uuid
                        ? "Self"
                        : `${item.registeredBy?.firstName} ${item.registeredBy?.lastName} (${item.registeredBy?.email})`}
                    </td>
                    {orgEvent.collectShipping && (
                      <td className="px-4 py-3">
                        <span>
                          {item.shippingAddress?.lineOne}
                          {item.shippingAddress?.lineTwo ? `, ${item.shippingAddress.lineTwo}` : ""}
                          {", " + item.shippingAddress?.city}
                          {", " + item.shippingAddress?.state}
                          {" " + item.shippingAddress?.zip}
                          {" " + item.shippingAddress?.country}
                        </span>
                      </td>
                    )}
                    {tableColumns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        {getResponseValText(col.key, item.formResponses)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6 + tableColumns.length + (orgEvent.collectShipping ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                    <em>No participants found.</em>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-sm text-gray-600">
          Displaying {selectableParticipants ? selectableParticipants.length : 0} of {totalItems} participants.
        </p>
        <div className="flex items-center gap-3">
          {selectableParticipants && selectableParticipants.length > 0 && (
            <Button variant="outline" icon={<IconDownload size={16} />} onClick={onDownloadParticipants}>
              Export CSV
            </Button>
          )}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChangeActivePage(Math.max(1, activePage - 1))}
                disabled={activePage <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                {activePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => onChangeActivePage(Math.min(totalPages, activePage + 1))}
                disabled={activePage >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      <UnregisterParticipantsModal
        show={showUnregisterModal}
        onClose={() => setShowUnregisterModal(false)}
        onConfirm={handleUnregisterParticipants}
      />
      <AutoSyncToProjectModal
        show={showSyncProjectModal}
        orgEvent={orgEvent}
        onClose={() => setShowSyncProjectModal(false)}
        onConfirm={(projectID) => handleConfigureAutoSync(projectID)}
      />
    </div>
  );
};

export default ParticipantsSegment;
