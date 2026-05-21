import { Button, Spinner } from "@libretexts/davis-react";
import { IconCopy, IconEdit, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { OrgEvent } from "../../../types";
import { copyToClipboard, parseAndFormatDate } from "../../../utils/misc";
import { OrgEventFeeWaiver } from "../../../types/OrgEvent";
import FeeWaiverStatusLabel from "./FeeWaiverStatusLabel";
import FeeWaiverModal from "./FeeWaiverModal";

const TABLE_COLUMNS = [
  { key: "name", text: "Name" },
  { key: "status", text: "Status" },
  { key: "code", text: "Code" },
  { key: "percentage", text: "Percent Discount" },
  { key: "expirationDate", text: "Expiration Date" },
  { key: "actions", text: "Actions" },
];

type FeeWaiversSegmentProps = {
  feeWaivers: OrgEventFeeWaiver[];
  orgEvent: OrgEvent;
  loading: boolean;
  canEdit: boolean;
  onUpdate: () => void;
};

const FeeWaiversSegment: React.FC<FeeWaiversSegmentProps> = ({
  feeWaivers,
  orgEvent,
  loading,
  canEdit,
  onUpdate,
}) => {
  const [showFeeWaiverModal, setShowFeeWaiverModal] = useState(false);
  const [feeWaiverToEdit, setFeeWaiverToEdit] = useState<OrgEventFeeWaiver>();

  function handleCloseFeeWaiverModal() {
    setShowFeeWaiverModal(false);
    setFeeWaiverToEdit(undefined);
    onUpdate();
  }

  function handleOpenFeeWaiverModal(feeWaiver?: OrgEventFeeWaiver) {
    setFeeWaiverToEdit(feeWaiver);
    setShowFeeWaiverModal(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800 m-0">Fee Waivers</h2>
        <Button
          variant="primary"
          icon={<IconPlus size={16} />}
          onClick={() => handleOpenFeeWaiverModal()}
        >
          Add Fee Waiver
        </Button>
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
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"
                  >
                    {col.text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {feeWaivers && feeWaivers.length > 0 ? (
                feeWaivers.map((item) => (
                  <tr key={item.code} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3">
                      <FeeWaiverStatusLabel active={item.active} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        {item.code}
                        <button
                          type="button"
                          title="Copy code"
                          className="p-1 hover:bg-gray-100 rounded text-blue-600"
                          onClick={async () => await copyToClipboard(item.code)}
                        >
                          <IconCopy size={14} />
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.percentage}%</td>
                    <td className="px-4 py-3">
                      {parseAndFormatDate(item.expirationDate, "MM/dd/yyyy hh:mm aa")}{" "}
                      ({item.timeZone.abbrev})
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="primary"
                        icon={<IconEdit size={14} />}
                        onClick={() => handleOpenFeeWaiverModal(item)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="px-4 py-8 text-center text-gray-500">
                    <em>No fee waivers found.</em>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <FeeWaiverModal
        show={showFeeWaiverModal}
        orgEvent={orgEvent}
        feeWaiverToEdit={feeWaiverToEdit}
        onClose={handleCloseFeeWaiverModal}
      />
    </div>
  );
};

export default FeeWaiversSegment;
