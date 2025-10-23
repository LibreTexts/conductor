import { useFormContext } from "react-hook-form";
import { CentralIdentityApp, SupportTicket } from "../../../types";
import RequestFormWithAuth from "./RequestFormWithAuth";
import {
  SupportTicketCategoryOptions,
  SupportTicketPriorityOptions,
} from "../../../utils/supportHelpers";
import { required } from "../../../utils/formRules";
import CtlNextGenSelect from "../../ControlledInputs/CtlNextGenSelect";
import CtlNextGenInput from "../../ControlledInputs/CtlNextGenInput";
import CtlNextGenTextarea from "../../ControlledInputs/CtlNextGenTextarea";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";

interface TechnicalSupportFormProps {
  autoCapturedURL?: boolean;
}

const TechnicalSupportForm: React.FC<TechnicalSupportFormProps> = ({
  autoCapturedURL,
}) => {
  const { control, watch } = useFormContext<SupportTicket>();
  const { data } = useQuery<CentralIdentityApp[]>({
    queryKey: ["central-identity-apps"],
    queryFn: async () => {
      const res = await api.getCentralIdentityPublicApps();
      return res.data.applications;
    },
  });

  return (
    <RequestFormWithAuth>
      <p className="font-semibold text-2xl mt-12 !mb-0">Request Info</p>
      <p className="text-gray-600 text-sm/6 !mt-1">
        Please only submit one ticket per issue. If you have multiple issues,
        please submit a separate ticket for each.
      </p>
      <div className="!mt-4">
        <CtlNextGenSelect
          name="category"
          control={control}
          label="Category"
          placeholder="Select a category..."
          rules={required}
          options={SupportTicketCategoryOptions?.map((l) => ({
            value: l.value,
            label: l.text,
          }))}
        />
      </div>
      {["technical", "feature"].includes(watch("category") || "") && (
        <div className="!mt-4">
          <CtlNextGenSelect
            name="apps"
            control={control}
            label="Application/Library"
            placeholder="Select the applications and/or libraries related to your ticket"
            options={
              data?.map((app) => ({
                value: app.id.toString(),
                label: app.name,
              })) || []
            }
            required={["technical", "feature"].includes(
              watch("category") || ""
            )}
          />
        </div>
      )}
      <div className="mt-4">
        <CtlNextGenSelect
          name="priority"
          control={control}
          label="Priority"
          placeholder="Select the priority level of your ticket"
          rules={required}
          options={SupportTicketPriorityOptions?.map((l) => ({
            value: l.value,
            label: l.text,
          }))}
        />
        <p className="text-xs text-gray-500 italic">
          Note: A higher priority does not guarantee a faster response. Support
          tickets created by users from LibreNet member campuses are reviewed
          first.
        </p>
      </div>
      <div className="!mt-4">
        <CtlNextGenInput
          name="title"
          control={control}
          label="Title"
          placeholder="Enter a brief summary of your issue"
          required={true}
          rules={required}
        />
      </div>
      {!autoCapturedURL && (
        <div className="mt-4">
          <CtlNextGenInput
            control={control}
            name="capturedURL"
            label="URL (if applicable)"
            placeholder="Enter the URL of the page this ticket is related to - this may help us resolve your issue faster"
            type="url"
          />
        </div>
      )}
      <CtlNextGenTextarea
        control={control}
        name="description"
        label="Description"
        placeholder="Please provide a detailed description of the issue you are experiencing. Include steps to reproduce the issue if possible."
        maxLength={2000}
        showRemaining
        rows={4}
        className="mt-4"
      />
      <p className="text-center italic mt-2 text-sm/6 text-gray-600">
        <strong>Note:</strong> Please include any relevant ADAPT question or
        course ID's in your description. Screenshots and videos of the issue are
        also extremely helpful and you can capture them using the "Screencast"
        feature below. If your issue is related to a Conductor project, please
        include the project ID if possible. This will help us resolve your issue
        faster.
      </p>
    </RequestFormWithAuth>
  );
};

export default TechnicalSupportForm;
