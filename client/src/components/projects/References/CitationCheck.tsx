import React from "react";
import { Card, Heading, Text } from "@libretexts/davis-react";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { CitedKey } from "./model";

interface CitationCheckProps {
  missing: CitedKey[];
  checkedAt: string;
  /** Library subdomain, for links to the citing pages. */
  library?: string;
}

/**
 * Citations found on pages by the last scan that match no reference in the
 * book. Only rendered when there are some.
 */
const CitationCheck: React.FC<CitationCheckProps> = ({
  missing,
  checkedAt,
  library,
}) => (
  <Card variant="elevated">
    <Card.Body>
      <section aria-labelledby="citation-check-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Heading
            level={3}
            id="citation-check-heading"
            className="flex items-center gap-2 text-lg"
          >
            <IconAlertTriangle
              size={20}
              className="shrink-0 text-warning"
              aria-hidden="true"
            />
            Cited but missing ({missing.length})
          </Heading>
          <Text size="sm" className="text-neutral-600">
            From the last citation scan, {new Date(checkedAt).toLocaleString()}
          </Text>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          These keys appear in{" "}
          <code className="text-xs">\librecite{"{…}"}</code> on pages but match
          no reference, so they show as “?” in the book. Add a reference with
          the same key, or fix the citation on the page.
        </p>
        <ul className="mt-3 space-y-2">
          {missing.map(({ key, pages }) => (
            <li key={key} className="text-sm">
              <code className="font-semibold">{key}</code>
              <span className="text-neutral-600"> — cited on </span>
              {pages.map((page, index) => (
                <React.Fragment key={page.pageID}>
                  {index > 0 && ", "}
                  {library ? (
                    <a
                      href={`https://${library}.libretexts.org/@go/page/${page.pageID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {page.title || `page ${page.pageID}`}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    page.title || `page ${page.pageID}`
                  )}
                </React.Fragment>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </Card.Body>
  </Card>
);

export default CitationCheck;
