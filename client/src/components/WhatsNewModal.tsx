import { Button, Link, Modal } from "@libretexts/davis-react";
import { IconCheck, IconExternalLink } from "@tabler/icons-react";
import ReactMarkdown, { type Components } from "react-markdown";
import { useLocation } from "react-router-dom";
import useWhatsNew from "../hooks/useWhatsNew";
import AuthHelper from "./util/AuthHelper";

/**
 * Routes where an authenticated-only request must not be made. `/login` and
 * `/fallback-auth` are AnonRoutes: a 401 from either of this feature's two
 * endpoints there trips the global 401 interceptor in Platform.tsx, which reads
 * `sessionInvalid` as a dead session and bounces the user to CAS.
 */
const SUPPRESSED_PATHS = ["/login", "/fallback-auth"];

/**
 * Markdown-rendered headings are nested under the modal's own title, so the
 * largest one an author writes must still come out below it. Everything h1-h3
 * collapses to h3 and h4+ to h4, which keeps the heading order valid no matter
 * what an author types (WCAG 2.2 AA, 1.3.1).
 */
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node, ...props }) => <h3 className="text-lg font-semibold" {...props} />,
  h2: ({ node, ...props }) => <h3 className="text-lg font-semibold" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-lg font-semibold" {...props} />,
  h4: ({ node, ...props }) => <h4 className="text-base font-semibold" {...props} />,
  h5: ({ node, ...props }) => <h4 className="text-base font-semibold" {...props} />,
  h6: ({ node, ...props }) => <h4 className="text-base font-semibold" {...props} />,
  /**
   * Davis `Link` rather than a bare `<a>`: it infers an external target from the
   * href, attaches target/rel itself, and appends both an icon and a visually
   * hidden "(opens in new tab)" that a hand-rolled `target="_blank"` leaves out
   * (WCAG 2.2 AA, 2.4.4). `node` is react-markdown's hast node and must be
   * dropped rather than spread onto the DOM. An anchor with no href is not a
   * link at all, so it renders as plain text instead of a dead one.
   */
  a: ({ node, href, children, ...props }) =>
    href ? (
      <Link href={href} {...props}>
        {children}
      </Link>
    ) : (
      <>{children}</>
    ),
};

/**
 * The notice itself. Split out from the gate below because its hooks fetch from
 * two authenticated-only endpoints, and a hook cannot be called conditionally —
 * an early `return null` inside this component would not stop the requests. The
 * gate therefore decides by whether to MOUNT this at all.
 */
const WhatsNewDialog: React.FC = () => {
  const { entry, shouldShow, dismiss } = useWhatsNew();

  if (!shouldShow || !entry) return null;

  return (
    <Modal open onClose={dismiss} size="lg">
      <Modal.Header>
        <Modal.Title className="!mt-1 !mb-0">What's New: {entry.title}</Modal.Title>
        <Modal.Close aria-label="Dismiss What's New notice" />
      </Modal.Header>
      <Modal.Body className="max-h-[70vh] overflow-y-auto">
        <div className="prose prose-code:before:hidden prose-code:after:hidden max-w-none">
          <ReactMarkdown components={MARKDOWN_COMPONENTS}>
            {entry.body}
          </ReactMarkdown>
        </div>
      </Modal.Body>
      <Modal.Footer>
        {entry.ctaUrl && entry.ctaLabel && (
          <Button
            as="a"
            href={entry.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            icon={<IconExternalLink />}
            onClick={dismiss}
          >
            {entry.ctaLabel}
          </Button>
        )}
        <Button onClick={dismiss} icon={<IconCheck size={18} />}>Got it!</Button>
      </Modal.Footer>
    </Modal>
  );
};

/**
 * The "What's New in Conductor" notice. Mounted once for the whole app, so it
 * has to be inert for anyone who is not signed in.
 *
 * This outer component deliberately calls NO data hooks. It decides from the
 * session cookie and the current path alone, and only then mounts the dialog
 * that does the fetching. `AuthHelper.isAuthenticated()` is the same
 * synchronous cookie read `PrivateRoute` uses, so it is correct on first paint
 * rather than waiting on a Redux dispatch.
 *
 * Dismissal is recorded by every exit route the Davis Modal offers (the close
 * button, Escape, and a backdrop click all reach `onClose`), so a user can never
 * close this in a way that leaves it un-acknowledged.
 */
const WhatsNewModal: React.FC = () => {
  const location = useLocation();

  if (!AuthHelper.isAuthenticated()) return null;
  if (SUPPRESSED_PATHS.includes(location.pathname)) return null;

  return <WhatsNewDialog />;
};

export default WhatsNewModal;
