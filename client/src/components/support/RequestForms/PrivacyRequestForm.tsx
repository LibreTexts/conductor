import { useFormContext } from "react-hook-form";
import { SupportTicket } from "../../../types";
import RequestFormWithAuth from "./RequestFormWithAuth";
import {
  PrivacyIntakeChannelOptions,
  PrivacyProductOptions,
  PrivacyRequestTypeOptions,
} from "../../../utils/supportHelpers";
import { useTypedSelector } from "../../../state/hooks";
import { Checkbox, FormSection, Input, Select, Stack, Text, Textarea } from "@libretexts/davis-react";

const PrivacyRequestForm: React.FC = () => {
  const user = useTypedSelector((state) => state.user);
  const isStaff = !!(user.isSupport || user.isSuperAdmin);
  const { watch, register, setValue } = useFormContext<SupportTicket>();
  const isAppeal = !!watch("privacy.appealOf");
  const isAgent = watch("privacy.actingForOther.isAgent") ?? false;
  const isSchoolRecord = watch("privacy.schoolRecord.isSchoolRecord") ?? false;
  const products = watch("privacy.products") ?? [];

  function toggleProduct(value: string, checked: boolean) {
    setValue(
      "privacy.products",
      checked ? [...products, value] : products.filter((p) => p !== value),
    );
  }

  return (
    <RequestFormWithAuth showGuestFields={isStaff}>
      <FormSection title={isAppeal ? "Appeal a Privacy Decision" : "Privacy Request"}>
        <Stack gap="md">
          <Text className="!mt-1">
            {isAppeal
              ? "Tell us why you disagree with our decision. We respond to appeals within 45 days."
              : "Use this form to access, correct, or delete your personal data, opt out of marketing, or ask a privacy question. We respond within 30 days."}
          </Text>
          {isStaff && (
            <Text className="text-sm">
              Logging a request on someone's behalf: enter the requester's contact info above, plus how and when the request arrived.
            </Text>
          )}
          {!isAppeal && (
            <Select
              label="Request type"
              placeholder="Select a request type..."
              required
              options={PrivacyRequestTypeOptions.filter((o) => o.value !== "appeal")}
              {...register("privacy.requestType", { required: "Request type is required" })}
            />
          )}
          {isStaff && (
            <>
              <Select
                label="How the request arrived"
                placeholder="Select a channel..."
                options={PrivacyIntakeChannelOptions}
                {...register("privacy.intakeChannel")}
              />
              <Input
                label="Date received (if earlier than today)"
                type="date"
                {...register("privacy.dateReceived")}
              />
            </>
          )}
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-medium">Products involved (optional)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PrivacyProductOptions.map((o) => (
                <Checkbox
                  key={o.value}
                  name={`privacy-product-${o.value}`}
                  label={o.label}
                  checked={products.includes(o.value)}
                  onChange={(checked) => toggleProduct(o.value, checked)}
                />
              ))}
            </div>
          </fieldset>
          <Checkbox
            name="privacy-acting-for-other"
            label="I am a parent, guardian, or agent acting for someone else"
            checked={isAgent}
            onChange={(checked) => setValue("privacy.actingForOther.isAgent", checked)}
          />
          {isAgent && (
            <Input
              label="Who are you acting for, and in what role?"
              required
              {...register("privacy.actingForOther.note", {
                required: isAgent ? "Please describe who you are acting for" : false,
              })}
            />
          )}
          <Checkbox
            name="privacy-school-record"
            label="This is about a school record (grades, coursework, or submissions from my institution)"
            checked={isSchoolRecord}
            onChange={(checked) => setValue("privacy.schoolRecord.isSchoolRecord", checked)}
          />
          {isSchoolRecord && (
            <Input
              label="School or institution"
              required
              {...register("privacy.schoolRecord.institution", {
                required: isSchoolRecord ? "Institution is required" : false,
              })}
            />
          )}
          <Input
            label="Title"
            placeholder="Enter a brief summary of your request"
            required
            {...register("title", { required: "Title is required" })}
          />
          <Textarea
            label={isAppeal ? "Why are you appealing?" : "Details"}
            placeholder="Describe your request. Do not include passwords or financial information."
            maxLength={1000}
            rows={4}
            required
            {...register("description", { required: "Details are required" })}
          />
          <Text className="text-sm">
            We may need to confirm your identity before acting on your request. We will only reply to the email address
            on your account or the one you enter here.
          </Text>
        </Stack>
      </FormSection>
    </RequestFormWithAuth>
  );
};

export default PrivacyRequestForm;
