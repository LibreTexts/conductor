import type { ReactNode } from "react";
import { Heading } from "@libretexts/davis-react";

/**
 * Section heading for the project overview cards. Styled as level 5 but rendered
 * as an h2 so the outline doesn't skip from the page h1.
 */
const CardHeading = ({ children }: { children: ReactNode }) => (
  <Heading
    as="h2"
    level={5}
    color="muted"
    className="mb-3 pb-2 border-b border-gray-200 uppercase tracking-wide"
  >
    {children}
  </Heading>
);

export default CardHeading;
