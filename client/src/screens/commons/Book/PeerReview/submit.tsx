import { useEffect, useMemo } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  Alert,
  Button,
  Heading,
  Input,
  Select,
  Checkbox,
  Textarea,
  Spinner,
} from "@libretexts/davis-react";
import { useTypedSelector } from "../../../../state/hooks";
import api from "../../../../api";
import { peerReviewAuthorTypes } from "../../../../components/util/ProjectHelpers";
import StarRating from "../../../../components/peerreview/StarRating.jsx";
import DavisLikertScale from "./DavisLikertScale";
import {
  CustomFormPrompt,
  CustomFormHeading,
  CustomFormTextBlock,
  GenericKeyTextValueObj,
} from "../../../../types";
import { usePeerReviewRubric } from "./usePeerReviewRubric";
import { useSubmitPeerReview } from "./useSubmitPeerReview";
import { peerReviewSchema, type PeerReviewFormValues } from "./schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDocumentTitle } from "usehooks-ts";

// Backend returns MongoDB documents — _id is present at runtime but not in the shared type.
type PRPrompt = CustomFormPrompt & { _id?: string };

type UIHeading = CustomFormHeading & { uiType: "heading" };
type UITextBlock = CustomFormTextBlock & { uiType: "textBlock" };
type UIPrompt = PRPrompt & { uiType: "prompt" };
type UIElement = UIHeading | UITextBlock | UIPrompt;

const authorTypeOpts = peerReviewAuthorTypes.map((t) => ({
  value: t.value,
  label: t.text,
}));

const PeerReviewSubmitPage = () => {
  useDocumentTitle("LibreTexts | Submit Peer Review");
  const { bookID } = useParams<{ bookID: string }>();
  const history = useHistory();
  const user = useTypedSelector((state) => state.user);

  useEffect(() => {
    window.scrollTo(0, 0);
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  const { data: book, isLoading: loadingBook, error: bookError } = useQuery({
    queryKey: ["pr-book", bookID],
    queryFn: async () => {
      const res = await api.getBookDetail(bookID);
      if (res.data.err) throw new Error(res.data.errMsg ?? "Unable to load book.");
      if (!res.data.book) throw new Error("Unable to load book.");
      return res.data.book as {
        projectID?: string;
        title?: string;
        allowAnonPR?: boolean;
      };
    },
    enabled: !!bookID,
    // Errors are surfaced inline — suppress the global QueryCache toast.
    meta: { errorMessage: "" },
    retry: false,
  });

  const {
    data: rubric,
    isLoading: loadingRubric,
    error: rubricError,
  } = usePeerReviewRubric(book?.projectID);

  const { control, handleSubmit, reset } = useForm<PeerReviewFormValues>({
    resolver: zodResolver(peerReviewSchema),
    defaultValues: {
      authorType: "",
      rating: 0,
      firstName: "",
      lastName: "",
      email: "",
      prompts: {},
    },
  });

  useEffect(() => {
    // wait for both book and user to populate before continuing check
    if (!book) return;
    if (!user) return;

    /**
     * If the book doesn't allow anonymous peer reviews and the user isn't logged in,
     * redirect back to Commons book page.
     * */ 
    if (!book.allowAnonPR && !user.isAuthenticated) {
      history.replace(`/book/${bookID}`);
    }

  }, [book, user])

  // Seed prompt defaults once rubric loads so every Controller is pre-registered.
  useEffect(() => {
    if (!rubric?.prompts) return;
    const defaults: Record<string, string | number | boolean> = {};
    for (const p of rubric.prompts) {
      if (p.promptType === "checkbox") defaults[String(p.order)] = false;
      else if (p.promptType.includes("likert")) defaults[String(p.order)] = 0;
      else defaults[String(p.order)] = "";
    }
    reset({
      authorType: "",
      rating: 0,
      firstName: "",
      lastName: "",
      email: "",
      prompts: defaults,
    });
  }, [rubric, reset]);

  const submitMutation = useSubmitPeerReview(bookID);

  const allElements = useMemo((): UIElement[] => {
    if (!rubric) return [];
    const headings: UIHeading[] = (rubric.headings ?? []).map((h) => ({
      ...h,
      uiType: "heading" as const,
    }));
    const textBlocks: UITextBlock[] = (rubric.textBlocks ?? []).map((t) => ({
      ...t,
      uiType: "textBlock" as const,
    }));
    const prompts: UIPrompt[] = (rubric.prompts ?? []).map((p) => ({
      ...(p as PRPrompt),
      uiType: "prompt" as const,
    }));
    return [...headings, ...textBlocks, ...prompts].sort(
      (a, b) => (a.order ?? 1) - (b.order ?? 1)
    );
  }, [rubric]);

  const onSubmit = (values: PeerReviewFormValues) => {
    if (!book?.projectID) return;

    const payload: Record<string, unknown> = {
      projectID: book.projectID,
      authorType: values.authorType,
      rating: values.rating,
    };

    if (!user.isAuthenticated) {
      payload.authorFirst = values.firstName;
      payload.authorLast = values.lastName;
      payload.authorEmail = values.email;
    }

    const promptResponses = ((rubric?.prompts ?? []) as PRPrompt[]).flatMap((prompt) => {
      const raw = values.prompts[String(prompt.order)];
      const entry: Record<string, unknown> = {
        promptID: prompt._id,
        promptType: prompt.promptType,
        order: prompt.order,
      };
      let include = false;

      if (prompt.promptType.includes("likert") && raw && Number(raw) !== 0) {
        entry.likertResponse = Number(raw);
        include = true;
      }
      if (prompt.promptType === "text" && typeof raw === "string" && raw.trim()) {
        entry.textResponse = raw;
        include = true;
      }
      if (prompt.promptType === "dropdown" && typeof raw === "string" && raw) {
        entry.dropdownResponse = raw;
        include = true;
      }
      if (prompt.promptType === "checkbox") {
        entry.checkboxResponse = raw;
        include = true;
      }

      return include ? [entry] : [];
    });

    payload.promptResponses = promptResponses;
    submitMutation.mutate(payload);
  };

  const isLoading = loadingBook || loadingRubric;
  const isPublicView = !!book?.allowAnonPR;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Heading level={1} className="mb-1">
            Submit a Peer Review
          </Heading>
          {book?.title && (
            <p className="text-gray-600">
              <em>{book.title}</em>
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => history.push(`/book/${bookID}`)}>
          Cancel
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 mb-6">
          <Spinner />
          <span>Loading peer review form...</span>
        </div>
      )}

      {bookError instanceof Error && (
        <Alert
          variant="error"
          message={bookError.message || "Unable to load book details."}
          className="mb-6"
        />
      )}

      {rubricError instanceof Error && (
        <Alert
          variant="error"
          message={rubricError.message || "Unable to load peer review rubric."}
          className="mb-6"
        />
      )}

      {!isLoading && !rubricError && !book?.projectID && (
        <Alert
          variant="warning"
          message="This book does not have a peer review rubric configured."
          className="mb-6"
        />
      )}

      {!isLoading && rubric && (
        <>
          {user.isAuthenticated && (
            <Alert
              variant="info"
              message={`You are logged into Conductor as ${user.firstName} ${user.lastName}.`}
              className="mb-4"
            />
          )}
          <Alert
            variant="info"
            message={
              isPublicView
                ? "Your name will be attached to this Peer Review. Peer Reviews for this resource are visible to all. Your email remains private."
                : "Your name will be attached to this Peer Review. If this Project is 'Public' and attached to a LibreTexts resource, its Peer Reviews are visible to all. Your email remains private."
            }
            className="mb-6"
          />

          {rubric.rubricTitle && (
            <p className="mb-4 text-sm text-gray-700">
              <strong>Rubric:</strong> {rubric.rubricTitle}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {!user.isAuthenticated && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="firstName"
                  rules={{ required: "First name is required." }}
                  render={({ field, fieldState: { error } }) => (
                    <Input
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="First Name"
                      placeholder="Enter first name..."
                      required
                      error={!!error}
                      errorMessage={error?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="lastName"
                  rules={{ required: "Last name is required." }}
                  render={({ field, fieldState: { error } }) => (
                    <Input
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="Last Name"
                      placeholder="Enter last name..."
                      required
                      error={!!error}
                      errorMessage={error?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="email"
                  rules={{
                    required: "Email is required.",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email address.",
                    },
                  }}
                  render={({ field, fieldState: { error } }) => (
                    <Input
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(e) => field.onChange(e.target.value)}
                      label="Email"
                      type="email"
                      placeholder="Enter email..."
                      required
                      error={!!error}
                      errorMessage={error?.message}
                      className="sm:col-span-2"
                    />
                  )}
                />
              </div>
            )}

            <Controller
              control={control}
              name="authorType"
              rules={{ required: "Please select your author type." }}
              render={({ field, fieldState: { error } }) => (
                <Select
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e) => field.onChange(e.target.value)}
                  label="I am a(n)"
                  placeholder="Choose..."
                  options={authorTypeOpts}
                  required
                  error={!!error}
                  errorMessage={error?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="rating"
              rules={{
                validate: (v) =>
                  (v >= 0.5 && v <= 5) || "Please rate this resource's overall quality.",
              }}
              render={({ field, fieldState: { error } }) => (
                <div>
                  <p
                    id="pr-rating-label"
                    className={`text-sm font-medium mb-2 ${
                      error ? "text-red-600" : "text-gray-700"
                    }`}
                  >
                    Please rate this resource's overall quality{" "}
                    <span className="text-red-500" aria-hidden="true">
                      *
                    </span>
                  </p>
                  <div className="flex justify-center">
                    {/* StarRating uses accessible radio fieldset — no Davis rating component available. */}
                    <StarRating
                      value={field.value}
                      onChange={field.onChange}
                      fieldLabel="pr-rating-label"
                      fieldRequired
                    />
                  </div>
                  {error && (
                    <p role="alert" className="text-red-600 text-sm mt-1">
                      {error.message}
                    </p>
                  )}
                </div>
              )}
            />

            {allElements.map((item) => {
              if (item.uiType === "heading") {
                return (
                  <Heading as="h2" level={4} key={item.order} className="!mt-8 border-b pb-1">
                    {(item as UIHeading).text}
                  </Heading>
                );
              }

              if (item.uiType === "textBlock") {
                return (
                  <div
                    key={item.order}
                    className="prose prose-code:before:hidden prose-code:after:hidden"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        marked((item as UITextBlock).text) as string
                      ),
                    }}
                  />
                );
              }

              if (item.uiType === "prompt") {
                const prompt = item as UIPrompt;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fieldName = `prompts.${prompt.order}` as any;

                if (["3-likert", "5-likert", "7-likert"].includes(prompt.promptType)) {
                  const pts = (
                    prompt.promptType === "3-likert" ? 3 : prompt.promptType === "5-likert" ? 5 : 7
                  ) as 3 | 5 | 7;
                  return (
                    <Controller
                      key={prompt.order}
                      control={control}
                      name={fieldName}
                      rules={
                        prompt.promptRequired
                          ? {
                              validate: (v) =>
                                (Number(v) >= 1 && Number(v) <= pts) ||
                                "Please select a response.",
                            }
                          : undefined
                      }
                      render={({ field, fieldState: { error } }) => (
                        <DavisLikertScale
                          name={`pr-likert-${prompt.order}`}
                          label={prompt.promptText ?? ""}
                          points={pts}
                          value={field.value ? Number(field.value) : null}
                          onChange={field.onChange}
                          required={prompt.promptRequired}
                          error={!!error}
                          errorMessage={error?.message}
                        />
                      )}
                    />
                  );
                }

                if (prompt.promptType === "text") {
                  return (
                    <Controller
                      key={prompt.order}
                      control={control}
                      name={fieldName}
                      rules={{
                        ...(prompt.promptRequired ? { required: "This field is required." } : {}),
                        validate: (v) =>
                          typeof v !== "string" ||
                          v.length <= 10000 ||
                          "Response must not exceed 10,000 characters.",
                      }}
                      render={({ field, fieldState: { error } }) => (
                        <Textarea
                          ref={field.ref}
                          name={`pr-text-${prompt.order}`}
                          value={typeof field.value === "string" ? field.value : ""}
                          onBlur={field.onBlur}
                          onChange={(e) => field.onChange(e.target.value)}
                          label={prompt.promptText ?? ""}
                          placeholder="Enter your response..."
                          required={prompt.promptRequired}
                          error={!!error}
                          errorMessage={error?.message}
                          rows={4}
                          showCharacterCount
                        />
                      )}
                    />
                  );
                }

                if (prompt.promptType === "dropdown" && Array.isArray(prompt.promptOptions)) {
                  const opts = (
                    prompt.promptOptions as GenericKeyTextValueObj<string>[]
                  ).map((o) => ({
                    value: o.value,
                    label: o.text,
                  }));
                  return (
                    <Controller
                      key={prompt.order}
                      control={control}
                      name={fieldName}
                      rules={
                        prompt.promptRequired
                          ? { required: "Please select an option." }
                          : undefined
                      }
                      render={({ field, fieldState: { error } }) => (
                        <Select
                          ref={field.ref}
                          name={`pr-dropdown-${prompt.order}`}
                          value={typeof field.value === "string" ? field.value : ""}
                          onBlur={field.onBlur}
                          onChange={(e) => field.onChange(e.target.value)}
                          label={prompt.promptText ?? ""}
                          placeholder="Choose..."
                          options={opts}
                          required={prompt.promptRequired}
                          error={!!error}
                          errorMessage={error?.message}
                        />
                      )}
                    />
                  );
                }

                if (prompt.promptType === "checkbox") {
                  return (
                    <Controller
                      key={prompt.order}
                      control={control}
                      name={fieldName}
                      rules={
                        prompt.promptRequired
                          ? {
                              validate: (v) => v === true || "This checkbox is required.",
                            }
                          : undefined
                      }
                      render={({ field, fieldState: { error } }) => (
                        <div>
                          <Checkbox
                            name={`pr-checkbox-${prompt.order}`}
                            label={prompt.promptText ?? ""}
                            checked={field.value === true}
                            onChange={(checked) => field.onChange(checked)}
                            required={prompt.promptRequired}
                            error={!!error}
                          />
                          {error && (
                            <p role="alert" className="text-red-600 text-sm mt-1">
                              {error.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                  );
                }
              }

              return null;
            })}

            {allElements.length === 0 && (
              <p className="text-center text-gray-400 py-8">No rubric configuration found.</p>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                variant="outline"
                type="button"
                onClick={() => history.push(`/book/${bookID}`)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitMutation.isPending}>
                Submit Review
              </Button>
            </div>
          </form>
        </>
      )}
      </div>
    </div>
  );
};

export default PeerReviewSubmitPage;
