import "./PeerReview.css";
import { useEffect, useState } from "react";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { format, parseISO } from "date-fns";
import { Spinner, Checkbox, Heading } from "@libretexts/davis-react";
import { getLikertResponseText } from "../util/LikertHelpers";
import { getPeerReviewAuthorText } from "../util/ProjectHelpers";
import StarRating from "./StarRating.jsx";
import useGlobalError from "../error/ErrorHooks";
import { PeerReview } from "../../types";

// Stable reference so the fetch effect below doesn't see a "new" object (and
// re-fire) on every render when the caller omits peerReviewData.
const EMPTY_REVIEW_DATA: Partial<PeerReview> = {};

type ReviewResponse = PeerReview["responses"][number];

type UIElement =
  | (NonNullable<PeerReview["headings"]>[number] & { uiType: "heading" })
  | (NonNullable<PeerReview["textBlocks"]>[number] & { uiType: "textBlock" })
  | (ReviewResponse & { uiType: "response"; dropdownText: string });

interface PeerReviewDisplayProps {
  /** Existing review ID to fetch, used when `peerReviewData` isn't already available. */
  peerReviewID?: string;
  /** Pre-loaded review data — skips the fetch when provided. */
  peerReviewData?: Partial<PeerReview>;
  /** Gates fetching, e.g. so a parent Modal can defer loading until it opens. Defaults to true. */
  active?: boolean;
  /** Hides Conductor-only fields (internal user check, exact time) for public/Commons contexts. */
  publicView?: boolean;
}

/**
 * Read-only rendering of a submitted Peer Review's responses. No Modal or
 * page chrome of its own, so it can be dropped into a Modal (see
 * PeerReviewView) or a standalone page (see Projects/PeerReview/view.tsx).
 */
const PeerReviewDisplay: React.FC<PeerReviewDisplayProps> = ({
  peerReviewID = "",
  peerReviewData = EMPTY_REVIEW_DATA,
  active = true,
  publicView = true,
}) => {
  const { handleGlobalError } = useGlobalError();

  const [allElements, setAllElements] = useState<UIElement[]>([]);
  const [reviewData, setReviewData] = useState<Partial<PeerReview>>({});
  const [reviewDate, setReviewDate] = useState("");
  const [reviewTime, setReviewTime] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (Object.keys(peerReviewData).length > 0) {
      setReviewData(peerReviewData);
    } else if (peerReviewID.length > 0) {
      setLoadingData(true);
      axios
        .get("/peerreview", { params: { peerReviewID } })
        .then((res) => {
          if (!res.data.err && typeof res.data.review === "object") {
            setReviewData(res.data.review);
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setLoadingData(false);
        })
        .catch((err) => {
          setLoadingData(false);
          handleGlobalError(err);
        });
    } else {
      handleGlobalError("No review data provided.");
    }
  }, [active, peerReviewID, peerReviewData, handleGlobalError]);

  useEffect(() => {
    if (Object.keys(reviewData).length === 0) return;
    setLoadingData(true);
    let allElem: UIElement[] = [];
    if (reviewData.createdAt) {
      const timestamp = parseISO(reviewData.createdAt);
      setReviewDate(format(timestamp, "MMM do, yyyy"));
      setReviewTime(format(timestamp, "h:mm a"));
    }
    if (Array.isArray(reviewData.headings)) {
      allElem = [
        ...allElem,
        ...reviewData.headings.map((h) => ({ ...h, uiType: "heading" as const })),
      ];
    }
    if (Array.isArray(reviewData.textBlocks)) {
      allElem = [
        ...allElem,
        ...reviewData.textBlocks.map((t) => ({ ...t, uiType: "textBlock" as const })),
      ];
    }
    if (Array.isArray(reviewData.responses)) {
      allElem = [
        ...allElem,
        ...reviewData.responses.map((item) => {
          let dropdownText = "Unknown";
          if (
            item.promptType === "dropdown" &&
            typeof item.dropdownResponse === "string" &&
            Array.isArray(item.promptOptions)
          ) {
            const found = item.promptOptions.find((o) => o.value === item.dropdownResponse);
            dropdownText = found?.text ?? "Unknown";
          }
          return { ...item, uiType: "response" as const, dropdownText };
        }),
      ];
    }
    allElem.sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 1;
      const bo = typeof b.order === "number" ? b.order : 1;
      return ao - bo;
    });
    setAllElements(allElem);
    setLoadingData(false);
  }, [reviewData]);

  if (loadingData) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
      {/* Metadata grid */}
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">Review Type</p>
          <span>{getPeerReviewAuthorText(reviewData.authorType ?? "")}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">Reviewer Name</p>
          <span>{reviewData.author}</span>
        </div>
        {typeof reviewData.rubricTitle === "string" && (
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">Rubric</p>
            <span>{reviewData.rubricTitle}</span>
          </div>
        )}
        {!publicView && !reviewData.anonAuthor && (
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">Conductor User</p>
            <span>✓</span>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">
            Review {!publicView ? "Time" : "Date"}
          </p>
          <span>
            {reviewDate}
            {!publicView && ` at ${reviewTime}`}
          </span>
        </div>
      </div>

      {/* Overall rating */}
      {typeof reviewData.rating === "number" && reviewData.rating > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">Overall Quality Rating:</p>
          <div className="flex justify-center">
            <StarRating value={reviewData.rating} displayMode singleRating />
          </div>
        </div>
      )}

      {/* Rubric elements */}
      {allElements.map((item) => {
        if (item.uiType === "heading") {
          return (
            <Heading level={4} key={item.order} className="!mt-8 border-b pb-1">
              {item.text}
            </Heading>
          );
        }
        if (item.uiType === "textBlock") {
          return (
            <div
              key={item.order}
              className="prose prose-code:before:hidden prose-code:after:hidden"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked(item.text) as string) }}
            />
          );
        }
        if (item.uiType === "response") {
          const labelCls = `text-sm font-medium ${
            item.promptRequired && item.promptType !== "checkbox"
              ? 'after:content-["*"] after:text-red-500 after:ml-0.5'
              : ""
          }`;

          if (typeof item.promptType === "string" && item.promptType.includes("likert")) {
            const pts = parseInt(item.promptType.split("-")[0]);
            if (!isNaN(pts) && pts > 0 && pts < 8) {
              return (
                <div key={item.order}>
                  <p className={labelCls}>{item.promptText}</p>
                  <div className="mt-1 rounded-md border bg-white px-3 py-2 shadow-sm">
                    {typeof item.likertResponse === "number" ? (
                      <p>
                        <em>
                          {getLikertResponseText(
                            pts === 7 ? "7-likert" : pts === 5 ? "5-likert" : "3-likert",
                            item.likertResponse
                          )}
                        </em>
                      </p>
                    ) : (
                      <p>
                        <em>No response</em>
                      </p>
                    )}
                  </div>
                </div>
              );
            }
          }
          if (item.promptType === "text") {
            return (
              <div key={item.order}>
                <p className={labelCls}>{item.promptText}</p>
                <div className="mt-1 rounded-md border bg-white px-3 py-2 shadow-sm">
                  {typeof item.textResponse === "string" && item.textResponse.length > 0 ? (
                    <p>{item.textResponse}</p>
                  ) : (
                    <p>
                      <em>No response</em>
                    </p>
                  )}
                </div>
              </div>
            );
          }
          if (item.promptType === "dropdown") {
            return (
              <div key={item.order}>
                <p className={labelCls}>{item.promptText}</p>
                <div className="mt-1 rounded-md border bg-white px-3 py-2 shadow-sm">
                  {item.dropdownText.length > 0 ? (
                    <p>
                      <em>{item.dropdownText}</em>
                    </p>
                  ) : (
                    <p>
                      <em>No response</em>
                    </p>
                  )}
                </div>
              </div>
            );
          }
          if (item.promptType === "checkbox") {
            return (
              <Checkbox
                key={item.order}
                name={`prview-checkbox-${item.order}`}
                label={item.promptText ?? ""}
                checked={!!item.checkboxResponse}
                disabled
              />
            );
          }
        }
        return null;
      })}

      {allElements.length === 0 && (
        <p className="text-center text-gray-400 py-4">No data found.</p>
      )}
    </div>
  );
};

export default PeerReviewDisplay;
