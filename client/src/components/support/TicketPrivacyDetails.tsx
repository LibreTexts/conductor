import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Badge, Button, Card, Divider, Heading, Input, Select, Stack, Text, Textarea } from "@libretexts/davis-react";
import { SupportTicket } from "../../types";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import {
  getOptionLabel,
  isPrivacyIdentityVerified,
  isPrivacyOverdue,
  PRIVACY_DENIAL_OUTCOMES,
  PrivacyDenialBasisOptions,
  PrivacyIntakeChannelOptions,
  PrivacyOutcomeOptions,
  PrivacyProductOptions,
  PrivacyRequestTypeOptions,
  PrivacyVerificationOptions,
} from "../../utils/supportHelpers";

type PrivacyFormValues = {
  requestType: string;
  intakeChannel: string;
  dateReceived: string;
  verificationMethod: string;
  verificationDate: string;
  responseDate: string;
  responseOutcome: string;
  responseSummary: string;
  denialReason: string;
  denialNote: string;
  extensionReason: string;
  extensionDueDate: string;
};

// Appeal type comes only from the appeal link, never an edit
const EditableRequestTypeOptions = PrivacyRequestTypeOptions.filter((o) => o.value !== "appeal");

const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const prettyDate = (iso?: string) => (iso ? format(parseISO(iso), "MMM d, yyyy") : "—");

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-3 py-1 text-sm">
    <span className="w-32 shrink-0 font-semibold text-gray-500">{label}</span>
    <span className="min-w-0 break-words text-gray-900">{children}</span>
  </div>
);

const TicketPrivacyDetails: React.FC<{ ticket: SupportTicket }> = ({ ticket }) => {
  const privacy = ticket.privacy!;
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const isClosed = ticket.status === "closed";
  const overdue = isPrivacyOverdue(ticket);

  const { register, watch, handleSubmit, formState, reset } = useForm<PrivacyFormValues>({
    values: {
      requestType: privacy.requestType,
      intakeChannel: privacy.intakeChannel,
      dateReceived: toDateInput(privacy.dateReceived),
      verificationMethod: privacy.identityVerification?.method ?? "",
      verificationDate: toDateInput(privacy.identityVerification?.date),
      responseDate: toDateInput(privacy.responseDate),
      responseOutcome: privacy.responseOutcome ?? "",
      responseSummary: privacy.responseSummary ?? "",
      denialReason: privacy.denialBasis?.reason ?? "",
      denialNote: privacy.denialBasis?.note ?? "",
      extensionReason: "",
      extensionDueDate: "",
    },
  });
  const isDenial = PRIVACY_DENIAL_OUTCOMES.includes(watch("responseOutcome"));

  const mutation = useMutation({
    mutationFn: async (payload: Parameters<typeof api.updateSupportTicket>[1]) => {
      const res = await api.updateSupportTicket(ticket.uuid, payload);
      if (res.data.err) throw new Error(res.data.errMsg);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(["ticket", ticket.uuid]);
      reset();
      addNotification({ type: "success", message: "Privacy details saved." });
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        message: error?.response?.data?.errMsg || "An error occurred while saving privacy details.",
      });
    },
  });

  // Only send fields staff changed, so the audit feed names exactly what moved
  function buildPrivacyPayload(v: PrivacyFormValues) {
    const dirty = formState.dirtyFields;
    const denialTouched = dirty.denialReason || dirty.denialNote || dirty.responseOutcome;
    return {
      ...(dirty.requestType && v.requestType && { requestType: v.requestType }),
      ...(dirty.intakeChannel && { intakeChannel: v.intakeChannel }),
      ...(dirty.dateReceived && v.dateReceived && { dateReceived: v.dateReceived }),
      ...((dirty.verificationMethod || dirty.verificationDate) &&
        v.verificationMethod && {
          identityVerification: {
            method: v.verificationMethod,
            ...(v.verificationDate && { date: v.verificationDate }),
          },
        }),
      ...(dirty.responseDate && v.responseDate && { responseDate: v.responseDate }),
      ...(dirty.responseOutcome && v.responseOutcome && { responseOutcome: v.responseOutcome }),
      ...(dirty.responseSummary && { responseSummary: v.responseSummary }),
      ...(denialTouched && {
        denialBasis:
          PRIVACY_DENIAL_OUTCOMES.includes(v.responseOutcome) && v.denialReason
            ? { reason: v.denialReason, ...(v.denialNote && { note: v.denialNote }) }
            : null,
      }),
    };
  }

  const withPrivacy = (v: PrivacyFormValues) => {
    const privacy = buildPrivacyPayload(v);
    return Object.keys(privacy).length ? { privacy } : {};
  };
  const save = handleSubmit((v) => mutation.mutate(withPrivacy(v)));
  const saveAndClose = handleSubmit((v) => mutation.mutate({ ...withPrivacy(v), status: "closed" }));
  const recordExtension = handleSubmit((v) => {
    if (!v.extensionReason || !v.extensionDueDate) {
      addNotification({ type: "error", message: "Extension reason and new due date are required." });
      return;
    }
    mutation.mutate({
      privacy: { extension: { reason: v.extensionReason, newDueDate: v.extensionDueDate } },
    });
  });

  return (
    <Card padding="sm" variant="default">
      <Card.Header>
        <Stack direction="horizontal" gap="md" align="center" justify="between">
          <Heading level={4} align="left" className="!mb-0">
            Privacy Inquiry
          </Heading>
          {overdue ? (
            <Badge variant="danger" label={`Overdue (due ${prettyDate(privacy.dueDate)})`} />
          ) : (
            <Badge variant={isClosed ? "success" : "primary"} label={`Due ${prettyDate(privacy.dueDate)}`} />
          )}
        </Stack>
      </Card.Header>
      <Card.Body className="py-4">
        <Stack gap="sm">
          {privacy.redactedAt && (
            <Alert
              variant="info"
              message={`Ticket content was redacted on ${prettyDate(privacy.redactedAt)} after the deletion request was fulfilled.`}
            />
          )}
          {!isClosed && !isPrivacyIdentityVerified(privacy) && (
            <Alert
              variant="warning"
              message="Identity not verified. Replies should only go to a verified contact."
            />
          )}
          <div className="flex flex-col">
            <Row label="Request type">{getOptionLabel(PrivacyRequestTypeOptions, privacy.requestType)}</Row>
            <Row label="Received">{prettyDate(privacy.dateReceived)}</Row>
            <Row label="Channel">{getOptionLabel(PrivacyIntakeChannelOptions, privacy.intakeChannel)}</Row>
            <Row label="Products">
              {privacy.products?.length
                ? privacy.products.map((p) => getOptionLabel(PrivacyProductOptions, p)).join(", ")
                : "—"}
            </Row>
            <Row label="Acting for other">
              {privacy.actingForOther?.isAgent ? privacy.actingForOther.note || "Yes" : "No"}
            </Row>
            <Row label="School record">
              {privacy.schoolRecord?.isSchoolRecord
                ? `Yes — refer to ${privacy.schoolRecord.institution || "institution"}`
                : "No"}
            </Row>
            {privacy.extension && (
              <Row label="Extended">
                To {prettyDate(privacy.extension.newDueDate)}: {privacy.extension.reason}
              </Row>
            )}
            {privacy.appealOf && (
              <Row label="Appeal of">
                <RouterLink to={`/support/ticket/${privacy.appealOf}`}>#{privacy.appealOf.slice(-7)}</RouterLink>
              </Row>
            )}
            {!!privacy.appealUUIDs?.length && (
              <Row label="Appeals">
                {privacy.appealUUIDs.map((a) => (
                  <RouterLink key={a} to={`/support/ticket/${a}`} className="mr-2">
                    #{a.slice(-7)}
                  </RouterLink>
                ))}
              </Row>
            )}
          </div>

          {!isClosed && (
            <form onSubmit={(e) => e.preventDefault()} aria-label="Privacy inquiry details">
              <Stack gap="md">
                <Divider />
                {!privacy.appealOf && (
                  <Select
                    label="Request type"
                    placeholder="Select a request type..."
                    helperText="Changing this recalculates the due date unless an extension was recorded."
                    options={EditableRequestTypeOptions}
                    {...register("requestType")}
                  />
                )}
                <Select
                  label="Channel"
                  placeholder="Select a channel..."
                  options={PrivacyIntakeChannelOptions}
                  {...register("intakeChannel")}
                />
                <Input label="Date received" type="date" {...register("dateReceived")} />
                <Select
                  label="Identity verification"
                  placeholder="Not yet verified"
                  options={PrivacyVerificationOptions}
                  {...register("verificationMethod")}
                />
                <Input label="Verified on" type="date" {...register("verificationDate")} />
                <Divider />
                <Text size="sm" className="font-semibold">Response (required to close)</Text>
                <Input label="Response date" type="date" {...register("responseDate")} />
                <Select
                  label="Outcome"
                  placeholder="Select an outcome..."
                  options={PrivacyOutcomeOptions}
                  {...register("responseOutcome")}
                />
                <Textarea
                  label="Response summary"
                  placeholder="What was done or sent, in a sentence or two"
                  maxLength={2000}
                  rows={3}
                  {...register("responseSummary")}
                />
                {isDenial && (
                  <>
                    <Select
                      label="Denial basis"
                      placeholder="Select a basis..."
                      options={PrivacyDenialBasisOptions}
                      {...register("denialReason")}
                    />
                    <Textarea
                      label="Denial explanation"
                      placeholder="Required when the basis is Other"
                      maxLength={1000}
                      rows={2}
                      {...register("denialNote")}
                    />
                  </>
                )}
                <Text size="xs" className="text-gray-600">
                  Closing emails the outcome to the requester{isDenial ? ", with a link to appeal" : ""}.
                </Text>
                <Stack direction="horizontal" gap="sm" justify="end">
                  <Button variant="outline" onClick={save} loading={mutation.isLoading} disabled={!formState.isDirty}>
                    Save
                  </Button>
                  <Button variant="primary" onClick={saveAndClose} loading={mutation.isLoading}>
                    Save and Close
                  </Button>
                </Stack>
                <Divider />
                <Text size="sm" className="font-semibold">Extension</Text>
                <Input label="New due date" type="date" {...register("extensionDueDate")} />
                <Textarea
                  label="Reason (sent to the requester)"
                  maxLength={1000}
                  rows={2}
                  {...register("extensionReason")}
                />
                <Stack direction="horizontal" justify="end">
                  <Button variant="outline" onClick={recordExtension} loading={mutation.isLoading}>
                    Record Extension and Notify
                  </Button>
                </Stack>
              </Stack>
            </form>
          )}

          {isClosed && (
            <div className="flex flex-col">
              <Divider className="my-2" />
              <Row label="Responded">{prettyDate(privacy.responseDate)}</Row>
              <Row label="Outcome">{getOptionLabel(PrivacyOutcomeOptions, privacy.responseOutcome)}</Row>
              <Row label="Summary">{privacy.responseSummary || "—"}</Row>
              {privacy.denialBasis && (
                <Row label="Denial basis">
                  {getOptionLabel(PrivacyDenialBasisOptions, privacy.denialBasis.reason)}
                  {privacy.denialBasis.note ? ` — ${privacy.denialBasis.note}` : ""}
                </Row>
              )}
              <Row label="Closed">{prettyDate(ticket.timeClosed)}</Row>
            </div>
          )}
        </Stack>
      </Card.Body>
    </Card>
  );
};

export default TicketPrivacyDetails;
