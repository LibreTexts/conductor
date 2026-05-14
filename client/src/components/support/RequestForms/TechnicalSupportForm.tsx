import { useFormContext } from "react-hook-form";
import { CentralIdentityApp, SupportTicket } from "../../../types";
import RequestFormWithAuth from "./RequestFormWithAuth";
import {
  SupportTicketCategoryOptions,
  SupportTicketPriorityOptions,
} from "../../../utils/supportHelpers";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import { useEffect, useId, useRef } from "react";
import { FormSection, Text, Input, Select, Textarea, Stack } from "@libretexts/davis-react";

interface TechnicalSupportFormProps {
  autoCapturedURL?: boolean;
}

const TechnicalSupportForm: React.FC<TechnicalSupportFormProps> = ({
  autoCapturedURL,
}) => {
  const priorityHelpId = useId();
  const prevShowAppsRef = useRef(false);
  const { watch, register } = useFormContext<SupportTicket>();
  const category = watch("category");
  const showApps = ["technical", "feature"].includes(category || "");

  useEffect(() => {
    // When the Application/Library field is removed, return focus to Category
    if (prevShowAppsRef.current && !showApps) {
      document.querySelector<HTMLSelectElement>('select[name="category"]')?.focus();
    }
    prevShowAppsRef.current = showApps;
  }, [showApps]);

  const { data } = useQuery<CentralIdentityApp[]>({
    queryKey: ["central-identity-apps"],
    queryFn: async () => {
      const res = await api.getCentralIdentityPublicApps();
      return res.data.applications;
    },
  });

  return (
    <RequestFormWithAuth>
      <FormSection title="Request Info">
        <Stack gap="md">
          <Text className="!mt-1">
            Please only submit one ticket per issue. If you have multiple issues,
            please submit a separate ticket for each.
          </Text>
          <Select
            label="Category"
            placeholder="Select a category..."
            required
            options={SupportTicketCategoryOptions?.map((l) => ({
              value: l.value,
              label: l.text,
            }))}
            {...register("category", { required: "Category is required" })}
          />
          {showApps && (
            <Select
              label="Application/Library"
              placeholder="Select application or library..."
              options={
                data?.map((app) => ({
                  value: app.id.toString(),
                  label: app.name,
                })) || []
              }
              required={showApps}
              {...register("apps", {
                required: showApps ? "Application/Library is required" : false
              })}
            />
          )}
          <div>
            <Select
              label="Priority"
              placeholder="Select the priority level of your ticket"
              required
              aria-describedby={priorityHelpId}
              options={SupportTicketPriorityOptions?.map((l) => ({
                value: l.value,
                label: l.text,
              }))}
              {...register("priority", { required: "Priority is required" })}
            />
            <Text id={priorityHelpId} className="text-xs mt-3">
              Note: A higher priority does not guarantee a faster response. Support
              tickets created by users from LibreNet member campuses are reviewed
              first.
            </Text>
          </div>
          <Input
            label="Title"
            placeholder="Enter a brief summary of your issue"
            required
            {...register("title", { required: "Title is required" })}
          />
          {!autoCapturedURL && (
            <Input
              label="URL (if applicable)"
              placeholder="Enter the URL related to this issue"
              type="url"
              {...register("capturedURL")}
            />
          )}
          <Textarea
            label="Description"
            placeholder="Please provide a detailed description of the issue you are experiencing. Include steps to reproduce the issue if possible."
            maxLength={2000}
            rows={4}
            required
            {...register("description", { required: "Description is required" })}
          />
          <Text className="text-center">
            <strong>Note:</strong> Please include any relevant ADAPT question or
            course ID's in your description. Screenshots and videos of the issue are
            also extremely helpful and you can capture them using the "Screencast"
            feature below. If your issue is related to a Conductor project, please
            include the project ID if possible. This will help us resolve your issue
            faster.
          </Text>
        </Stack>
      </FormSection>
    </RequestFormWithAuth>
  );
};

export default TechnicalSupportForm;
