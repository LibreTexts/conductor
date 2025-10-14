import { Controller, useFormContext } from "react-hook-form";
import { CentralIdentityApp, SupportTicket } from "../../../types";
import RequestFormWithAuth from "./RequestFormWithAuth";
import { Dropdown } from "semantic-ui-react";
import {
  SupportTicketCategoryOptions,
  SupportTicketPriorityOptions,
} from "../../../utils/supportHelpers";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { required } from "../../../utils/formRules";
import CtlTextArea from "../../ControlledInputs/CtlTextArea";

interface TechnicalSupportFormProps {
  apps: CentralIdentityApp[];
  autoCapturedURL?: boolean;
}

const TechnicalSupportForm: React.FC<TechnicalSupportFormProps> = ({
  apps,
  autoCapturedURL,
}) => {
  const { control, watch } = useFormContext<SupportTicket>();

  return (
    <RequestFormWithAuth>
      <div>
        <p className="font-semibold text-2xl mt-12">Request Info</p>
        <p className="text-gray-600 text-sm/6 !mt-1">
          Please only submit one ticket per issue. If you have multiple issues,
          please submit a separate ticket for each.
        </p>
        <div className="mt-4">
          <label
            className="form-field-label form-required"
            htmlFor="selectCategory"
          >
            Category
          </label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Dropdown
                id="selectCategory"
                options={SupportTicketCategoryOptions}
                {...field}
                onChange={(e, { value }) => {
                  field.onChange(value);
                }}
                fluid
                selection
                search
                placeholder="Select the category of your ticket"
              />
            )}
          />
        </div>
        {watch("category") &&
          ["technical", "feature"].includes(watch("category") as string) && (
            <div className="mt-2">
              <label
                className="form-field-label form-required"
                htmlFor="selectApps"
              >
                Application/Library (select all that apply)
              </label>
              <Controller
                name="apps"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="selectApps"
                    options={apps.map((app) => ({
                      key: app.id,
                      value: app.id,
                      text: app.name,
                    }))}
                    {...field}
                    onChange={(e, { value }) => {
                      field.onChange(value);
                    }}
                    fluid
                    selection
                    multiple
                    search
                    required
                    placeholder="Select the applications and/or libraries related to your ticket"
                  />
                )}
              />
            </div>
          )}
        <div className="mt-4">
          <label
            className="form-field-label form-required"
            htmlFor="selectPriority"
          >
            Priority
          </label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Dropdown
                id="selectPriority"
                options={SupportTicketPriorityOptions}
                {...field}
                onChange={(e, { value }) => {
                  field.onChange(value);
                }}
                fluid
                selection
                placeholder="Select the priority of your ticket"
              />
            )}
          />
          <p className="text-xs text-gray-500 italic">
            Note: A higher priority does not guarantee a faster response.
            Support tickets created by users from LibreNet member campuses are
            reviewed first.
          </p>
        </div>
        <div className="!mt-4">
          <CtlTextInput
            control={control}
            name="title"
            label="Subject"
            placeholder="Enter a subject/brief title for your ticket"
            rules={required}
            required
            maxLength={200}
          />
        </div>
        {!autoCapturedURL && (
          <div className="mt-4">
            <CtlTextInput
              control={control}
              name="capturedURL"
              label="URL (if applicable)"
              placeholder="Enter the URL of the page this ticket is related to - this may help us resolve your issue faster"
              type="url"
            />
          </div>
        )}
        <CtlTextArea
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
          course ID's in your description. Screenshots and videos of the issue
          are also extremely helpful and you can capture them using the
          "Screencast" feature below. If your issue is related to a Conductor
          project, please include the project ID if possible. This will help us
          resolve your issue faster.
        </p>
      </div>
    </RequestFormWithAuth>
  );
};

export default TechnicalSupportForm;
