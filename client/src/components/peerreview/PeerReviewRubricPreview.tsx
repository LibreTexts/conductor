import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  Alert,
  Button,
  Checkbox,
  Heading,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@libretexts/davis-react";
import StarRating from "./StarRating.jsx";
import DavisLikertScale from "./DavisLikertScale";
import { peerReviewAuthorTypes } from "../util/ProjectHelpers";
import { usePeerReviewRubricById } from "./usePeerReviewRubricById";
import {
  CustomFormHeading,
  CustomFormPrompt,
  CustomFormTextBlock,
} from "../../types";

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

interface PeerReviewRubricPreviewProps {
  /** The rubric to preview. */
  rubricID: string;
  /** Resource/project title shown beneath the heading, if applicable. */
  resourceTitle?: string;
  /** Called when the user is done previewing (Back/Done buttons). */
  onDone: () => void;
}

/**
 * Read-through preview of a Peer Review rubric — shows the same fields a
 * reviewer would fill out, but nothing here is saved. Used when choosing a
 * rubric (e.g. from Peer Review Settings) before committing to it.
 */
const PeerReviewRubricPreview: React.FC<PeerReviewRubricPreviewProps> = ({
  rubricID,
  resourceTitle,
  onDone,
}) => {
  useEffect(() => {
    window.scrollTo(0, 0);
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  const { data: rubric, isLoading, error } = usePeerReviewRubricById(rubricID);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [authorType, setAuthorType] = useState("");
  const [rating, setRating] = useState(0);
  const [promptValues, setPromptValues] = useState<
    Record<number, string | number | boolean>
  >({});

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

  const handlePromptChange = (order: number, value: string | number | boolean) => {
    setPromptValues((prev) => ({ ...prev, [order]: value }));
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Heading level={1} className="mb-1">
              Preview Peer Review Rubric
            </Heading>
            {resourceTitle && (
              <p className="text-gray-600">
                <em>{resourceTitle}</em>
              </p>
            )}
          </div>
          <Button variant="outline" onClick={onDone}>
            Back to Peer Review Settings
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-3 mb-6">
            <Spinner />
            <span>Loading rubric...</span>
          </div>
        )}

        {error instanceof Error && (
          <Alert
            variant="error"
            message={error.message || "Unable to load peer review rubric."}
            className="mb-6"
          />
        )}

        {!isLoading && rubric && (
          <>
            <Alert
              variant="info"
              message="This is a preview of what reviewers will see. Responses entered here are not saved."
              className="mb-6"
            />

            {rubric.rubricTitle && (
              <p className="mb-4 text-sm text-gray-700">
                <strong>Rubric:</strong> {rubric.rubricTitle}
              </p>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  name="previewFirstName"
                  label="First Name"
                  placeholder="Enter first name..."
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  name="previewLastName"
                  label="Last Name"
                  placeholder="Enter last name..."
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <Input
                  name="previewEmail"
                  label="Email"
                  type="email"
                  placeholder="Enter email..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sm:col-span-2"
                />
              </div>

              <Select
                name="previewAuthorType"
                label="I am a(n)"
                placeholder="Choose..."
                options={authorTypeOpts}
                value={authorType}
                onChange={(e) => setAuthorType(e.target.value)}
              />

              <div>
                <p className="text-sm font-medium mb-2 text-gray-700">
                  Please rate this resource's overall quality
                </p>
                <div className="flex justify-center">
                  <StarRating
                    value={rating}
                    onChange={setRating}
                    fieldLabel="preview-rating-label"
                  />
                </div>
              </div>

              {allElements.map((item) => {
                if (item.uiType === "heading") {
                  return (
                    <Heading
                      as="h2"
                      level={4}
                      key={item.order}
                      className="!mt-8 border-b pb-1"
                    >
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

                  if (
                    ["3-likert", "5-likert", "7-likert"].includes(
                      prompt.promptType
                    )
                  ) {
                    const pts = (
                      prompt.promptType === "3-likert"
                        ? 3
                        : prompt.promptType === "5-likert"
                        ? 5
                        : 7
                    ) as 3 | 5 | 7;
                    const val = promptValues[prompt.order];
                    return (
                      <DavisLikertScale
                        key={prompt.order}
                        name={`preview-likert-${prompt.order}`}
                        label={prompt.promptText ?? ""}
                        points={pts}
                        value={typeof val === "number" ? val : null}
                        onChange={(v) => handlePromptChange(prompt.order, v)}
                        required={prompt.promptRequired}
                      />
                    );
                  }

                  if (prompt.promptType === "text") {
                    const val = promptValues[prompt.order];
                    return (
                      <Textarea
                        key={prompt.order}
                        name={`preview-text-${prompt.order}`}
                        label={prompt.promptText ?? ""}
                        placeholder="Enter your response..."
                        required={prompt.promptRequired}
                        value={typeof val === "string" ? val : ""}
                        onChange={(e) =>
                          handlePromptChange(prompt.order, e.target.value)
                        }
                        rows={4}
                      />
                    );
                  }

                  if (
                    prompt.promptType === "dropdown" &&
                    Array.isArray(prompt.promptOptions)
                  ) {
                    const opts = prompt.promptOptions.map((o) => ({
                      value: o.value,
                      label: o.text,
                    }));
                    const val = promptValues[prompt.order];
                    return (
                      <Select
                        key={prompt.order}
                        name={`preview-dropdown-${prompt.order}`}
                        label={prompt.promptText ?? ""}
                        placeholder="Choose..."
                        options={opts}
                        required={prompt.promptRequired}
                        value={typeof val === "string" ? val : ""}
                        onChange={(e) =>
                          handlePromptChange(prompt.order, e.target.value)
                        }
                      />
                    );
                  }

                  if (prompt.promptType === "checkbox") {
                    return (
                      <Checkbox
                        key={prompt.order}
                        name={`preview-checkbox-${prompt.order}`}
                        label={prompt.promptText ?? ""}
                        checked={promptValues[prompt.order] === true}
                        onChange={(checked) =>
                          handlePromptChange(prompt.order, checked)
                        }
                        required={prompt.promptRequired}
                      />
                    );
                  }
                }

                return null;
              })}

              {allElements.length === 0 && (
                <p className="text-center text-gray-400 py-8">
                  No rubric configuration found.
                </p>
              )}

              <div className="flex justify-end pt-6 border-t">
                <Button onClick={onDone}>Done</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PeerReviewRubricPreview;
