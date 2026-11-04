import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDocumentTitle, useMediaQuery } from "usehooks-ts";
import { format, parseISO } from "date-fns";
import DOMPurify from "dompurify";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Dialog,
  EmptyState,
  Heading,
  Link as DavisLink,
  Skeleton,
  Spinner,
  Stack,
  Text,
  VisuallyHidden,
} from "@libretexts/davis-react";
import {
  Icon,
  IconAlertTriangle,
  IconBuildingBank,
  IconCategory,
  IconCheck,
  IconClock,
  IconCode,
  IconCopy,
  IconEdit,
  IconLanguage,
  IconLicense,
  IconLink,
  IconLock,
  IconUser,
} from "@tabler/icons-react";
import api from "../../../api";
import CopyButton from "../../../components/util/CopyButton";
import CopyFieldButton from "../../../components/util/CopyFieldButton";
import useClientConfig from "../../../hooks/useClientConfig";
import useH5PAuthoringEnabled from "../../../hooks/useH5PAuthoringEnabled";
import { ActivityEditorRole, CommonsActivity } from "../../../types";
import { getLanguageName } from "../../../utils/languageCodes";
import {
  buildActivityAttribution,
  buildActivityEmbedCode,
  getActivityEmbedURL,
  getActivityLicense,
  getContentTypeIcon,
  getContentTypeName,
} from "../../../utils/activityHelpers";

/** Matches Tailwind's `lg`, where the page switches to two columns. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Tags allowed in a description. Migrated Studio descriptions are Drupal rich
 * text; this keeps their structure and drops everything else.
 */
const DESCRIPTION_TAGS = ["p", "br", "ul", "ol", "li", "strong", "em", "b", "i", "a", "h3", "h4", "blockquote"];

function isHTML(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

/**
 * Loads h5p-service's resizer once per page. It grows the player iframe to fit
 * the activity, through the same postMessage handshake published embeds use.
 */
function useH5PResizer(origin?: string) {
  useEffect(() => {
    if (!origin || document.querySelector("script[data-h5p-resizer]")) return;
    const script = document.createElement("script");
    script.src = `${origin.replace(/\/+$/, "")}/h5p/core/js/h5p-resizer.js`;
    script.async = true;
    script.dataset.h5pResizer = "true";
    document.body.appendChild(script);
  }, [origin]);
}

/** Polite announcement for copy actions, whose button label also changes. */
const CopiedAnnouncement = ({ copied, what }: { copied: boolean; what: string }) => (
  <VisuallyHidden aria-live="polite">{copied ? `${what} copied to clipboard` : ""}</VisuallyHidden>
);

const ContentTypeTile = ({ icon: TypeIcon, size }: { icon: Icon; size: "lg" | "sm" }) => (
  <div
    className={
      size === "lg"
        ? "flex h-40 items-center justify-center rounded-md bg-primary-50"
        : "flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-50"
    }
    aria-hidden="true"
  >
    <div
      className={
        size === "lg"
          ? "flex h-[72px] w-[72px] items-center justify-center rounded-lg bg-white"
          : "flex items-center justify-center"
      }
    >
      <TypeIcon size={size === "lg" ? 36 : 24} className="text-primary-500" />
    </div>
  </div>
);

type DetailRow = { key: string; label: string; icon: Icon; value: React.ReactNode };

function buildDetailRows(activity: CommonsActivity): DetailRow[] {
  const rows: DetailRow[] = [];
  const typeName = getContentTypeName(activity);
  const license = getActivityLicense(activity.license);
  if (typeName) {
    rows.push({ key: "type", label: "Content type", icon: getContentTypeIcon(activity.library), value: typeName });
  }
  if (activity.subjects?.length) {
    rows.push({
      key: "subject",
      label: activity.subjects.length > 1 ? "Subjects" : "Subject",
      icon: IconCategory,
      value: activity.subjects.join(", "),
    });
  }
  if (activity.authors.length) {
    rows.push({
      key: "author",
      label: activity.authors.length > 1 ? "Authors" : "Author",
      icon: IconUser,
      value: activity.authors.join(", "),
    });
  }
  if (activity.publisher) {
    rows.push({ key: "institution", label: "Institution", icon: IconBuildingBank, value: activity.publisher });
  }
  if (license) {
    rows.push({
      key: "license",
      label: "License",
      icon: IconLicense,
      value: license.url ? (
        <DavisLink href={license.url} external target="_blank" rel="noopener noreferrer license">
          {license.text}
        </DavisLink>
      ) : (
        license.text
      ),
    });
  }
  if (activity.language) {
    rows.push({ key: "language", label: "Language", icon: IconLanguage, value: getLanguageName(activity.language) });
  }
  if (activity.updatedAt) {
    rows.push({
      key: "updated",
      label: "Updated",
      icon: IconClock,
      value: format(parseISO(activity.updatedAt), "MMM d, yyyy"),
    });
  }
  return rows;
}

const DetailsList = ({ rows }: { rows: DetailRow[] }) => (
  <dl className="m-0 flex flex-col gap-3">
    {rows.map(({ key, label, icon: RowIcon, value }) => (
      <div key={key} className="flex items-start gap-3">
        <RowIcon size={20} className="mt-0.5 shrink-0 text-neutral-600" aria-hidden="true" />
        <VisuallyHidden as="dt">{label}</VisuallyHidden>
        <dd className="m-0 min-w-0 break-words">
          <Text>{value}</Text>
        </dd>
      </div>
    ))}
  </dl>
);

const Tags = ({ tags }: { tags?: string[] }) =>
  tags?.length ? (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          <Badge label={tag} />
        </li>
      ))}
    </ul>
  ) : null;

const PublicActions = ({
  pageURL,
  onEmbed,
  embedAvailable,
  size,
}: {
  pageURL: string;
  onEmbed: () => void;
  embedAvailable: boolean;
  size: "md" | "lg";
}) => (
  <div className="grid grid-cols-2 gap-3">
    <CopyButton val={pageURL} timeout={2000}>
      {({ copied, copy }) => (
        <>
          <Button
            variant="outline"
            size={size}
            fullWidth
            icon={copied ? <IconCheck size={16} /> : <IconLink size={16} />}
            onClick={() => copy()}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
          <CopiedAnnouncement copied={copied} what="Link" />
        </>
      )}
    </CopyButton>
    <Button
      variant="primary"
      size={size}
      fullWidth
      icon={<IconCode size={16} />}
      onClick={onEmbed}
      softDisabled={!embedAvailable}
    >
      Embed
    </Button>
  </div>
);

const Player = ({ activity, origin }: { activity: CommonsActivity; origin?: string }) => {
  const [loaded, setLoaded] = useState(false);
  if (!origin) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-md bg-neutral-100 p-6">
        <Text color="muted">The activity player is not available right now.</Text>
      </div>
    );
  }
  return (
    <div className="relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-neutral-100">
          <Spinner size="lg" text="Loading activity" />
        </div>
      )}
      <iframe
        src={getActivityEmbedURL(origin, activity.h5pContentID)}
        title={`${activity.title} (interactive activity)`}
        className="block w-full rounded-md border-0"
        style={{ minHeight: 450 }}
        allow="fullscreen"
        allowFullScreen
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};

const Summary = ({ description }: { description?: string }) => {
  const html = useMemo(
    () =>
      description && isHTML(description)
        ? DOMPurify.sanitize(description, { ALLOWED_TAGS: DESCRIPTION_TAGS, ALLOWED_ATTR: ["href"] })
        : null,
    [description]
  );
  if (!description?.trim()) return null;
  return (
    <Card padding="sm">
      <Stack direction="vertical" gap="sm">
        <Heading level={2}>Summary</Heading>
        {html ? (
          <div className="prose max-w-[95ch]" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <Text as="p" className="max-w-[95ch] whitespace-pre-line">
            {description}
          </Text>
        )}
      </Stack>
    </Card>
  );
};

/** A titled value in the details card, set off by a divider, with its own Copy button. */
const CopySection = ({
  title,
  value,
  headingLevel,
  size,
  mono = false,
}: {
  title: string;
  value: string;
  headingLevel: 2 | 3;
  size: "sm" | "md";
  mono?: boolean;
}) => (
  <section className="border-t border-neutral-200 pt-4">
    <Stack direction="vertical" gap="xs">
      <Stack direction="horizontal" gap="sm" align="center" justify="between">
        <Heading level={headingLevel} className="text-base! mb-0!">{title}</Heading>
        <CopyFieldButton value={value} label={title} size={size} />
      </Stack>
      <Text as="p" className={mono ? "font-mono break-all" : "break-words"}>
        {value}
      </Text>
    </Stack>
  </section>
);

/** H5P ID, ADAPT ID when the sync has found one, and attribution. */
const CopySections = ({
  activity,
  headingLevel,
  size,
}: {
  activity: CommonsActivity;
  headingLevel: 2 | 3;
  size: "sm" | "md";
}) => (
  <>
    <CopySection title="H5P ID" value={String(activity.h5pContentID)} headingLevel={headingLevel} size={size} mono />
    {activity.adaptID && (
      <CopySection title="ADAPT ID" value={activity.adaptID} headingLevel={headingLevel} size={size} mono />
    )}
    <CopySection
      title="Attribution"
      value={buildActivityAttribution(activity)}
      headingLevel={headingLevel}
      size={size}
    />
  </>
);

const EmbedDialog = ({
  open,
  onClose,
  code,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
}) => (
  <Dialog open={open} onClose={onClose} size="lg">
    <Dialog.Header>
      <Dialog.Title>Embed this activity</Dialog.Title>
      <Dialog.Description>
        Paste into a LibreTexts page, LMS, or any site that accepts iframes.
      </Dialog.Description>
    </Dialog.Header>
    <pre
      className="m-0 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md bg-neutral-100 p-4 font-mono text-sm"
      tabIndex={0}
      aria-label="Embed code"
    >
      {code}
    </pre>
    <Dialog.Footer>
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
      <CopyButton val={code} timeout={2000}>
        {({ copied, copy }) => (
          <>
            <Button
              variant="primary"
              icon={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              onClick={() => copy()}
            >
              {copied ? "Copied" : "Copy embed code"}
            </Button>
            <CopiedAnnouncement copied={copied} what="Embed code" />
          </>
        )}
      </CopyButton>
    </Dialog.Footer>
  </Dialog>
);

const VIEWER_REASON: Record<ActivityEditorRole, string> = {
  owner: "You're seeing this because you're the author of this activity.",
  collaborator: "You're seeing this because you're a collaborator on this activity.",
  staff: "You're seeing this because you have LibreTexts staff access. The author and other visitors don't see this notice.",
};

/**
 * Shown to anyone who may edit the activity: its owner, a collaborator, or
 * LibreTexts staff. It offers Edit and always says why the viewer has it, so
 * nobody mistakes privileged access for what every visitor sees. On a private
 * activity it also warns that the page is not public, since otherwise it looks
 * identical to a public one.
 */
const ViewerAccessNotice = ({ activity }: { activity: CommonsActivity }) => {
  const authoringEnabled = useH5PAuthoringEnabled();
  if (!activity.viewerRole) return null;
  const why = VIEWER_REASON[activity.viewerRole];

  const whoCanOpen =
    activity.viewerRole === "staff"
      ? "only its author, collaborators and LibreTexts staff can open this page"
      : "only its author and collaborators can open this page";
  const alert =
    activity.visibility === "private" ? (
      <Alert
        variant="warning"
        title="This activity is private"
        asHeading="h2"
        message={`It doesn't appear in the catalog, and ${whoCanOpen}. ${why} Anyone else who follows this link sees "This activity isn't available".`}
      />
    ) : (
      <Alert
        variant="info"
        title="You can edit this activity"
        asHeading="h2"
        message={`${why} Visitors without edit access don't see this option.`}
      />
    );

  if (!authoringEnabled) return alert;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">{alert}</div>
      <Button
        as={Link}
        to={`/h5p/${activity.activityID}/edit`}
        variant="primary"
        icon={<IconEdit size={18} />}
        className="bg-primary! text-white! shrink-0 sm:self-center"
      >
        Edit
      </Button>
    </div>
  );
};

const PageBreadcrumb = ({ current }: { current: React.ReactNode }) => (
  <div className="border-b border-neutral-200 px-6 py-3">
    <Breadcrumb aria-label="Page navigation">
      <Breadcrumb.Item href="/interactives">Interactives</Breadcrumb.Item>
      <Breadcrumb.Item isCurrent>{current}</Breadcrumb.Item>
    </Breadcrumb>
  </div>
);

const LoadingView = ({ isDesktop }: { isDesktop: boolean }) => (
  <>
    <PageBreadcrumb current={<Skeleton variant="text" width={160} />} />
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[400px_minmax(0,1fr)]">
      <Card padding="sm">
        <Stack direction="vertical" gap="md">
          {isDesktop && <Skeleton variant="rounded" height={160} />}
          <Skeleton variant="text" width={260} height={32} className="mx-auto" />
          {isDesktop &&
            Array.from({ length: 7 }, (_, i) => (
              <Stack key={i} direction="horizontal" gap="sm" align="center">
                <Skeleton variant="circular" width={20} height={20} />
                <Skeleton variant="text" width="60%" />
              </Stack>
            ))}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" softDisabled icon={<IconLink size={16} />}>
              Copy link
            </Button>
            <Button variant="primary" softDisabled icon={<IconCode size={16} />}>
              Embed
            </Button>
          </div>
        </Stack>
      </Card>
      <Stack direction="vertical" gap="md">
        <Card padding="sm">
          <Skeleton variant="text" lines={3} />
        </Card>
        <Card padding="sm">
          <div className="flex aspect-video items-center justify-center rounded-md bg-neutral-100">
            <Spinner size="lg" text="Loading activity" />
          </div>
        </Card>
      </Stack>
    </div>
  </>
);

const MessageView = ({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) => (
  <div className="flex justify-center px-4 py-12">
    <Card padding="md" className="w-full max-w-[640px]">
      <EmptyState icon={icon} title={title} description={description} action={action} />
    </Card>
  </div>
);

/**
 * The public page for one H5P activity in Commons, reached at
 * `/interactive/:activityID` and by redirect from old Studio links.
 *
 * Every detail row and every card other than the player renders only when its
 * data exists, so a migrated activity with nothing but a title and a content
 * type still reads as a complete page.
 */
const CommonsActivityPage = () => {
  const { activityID } = useParams<{ activityID: string }>();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { clientConfig } = useClientConfig();
  const embedOrigin = clientConfig?.h5p_embed_origin || undefined;
  const [embedOpen, setEmbedOpen] = useState(false);

  const { data: activity, isLoading, error, refetch } = useQuery<CommonsActivity, any>({
    queryKey: ["commons-activity", activityID],
    queryFn: async () => (await api.getCommonsActivity(activityID)).data.activity,
    retry: (count, err) => ![400, 404].includes(err?.response?.status) && count < 2,
    refetchOnWindowFocus: false,
  });

  useH5PResizer(embedOrigin);
  useDocumentTitle(activity?.title ? `LibreCommons | ${activity.title}` : "LibreCommons");

  if (isLoading) return <LoadingView isDesktop={isDesktop} />;

  if (error || !activity) {
    const status = error?.response?.status;
    if (status === 400 || status === 404 || !error) {
      // One message for private, removed and mistyped links alike, so the
      // page never confirms that a private activity exists.
      return (
        <MessageView
          icon={<IconLock size={32} />}
          title="This activity isn't available"
          description="It may be private, or removed by its author. If you were sent this link, ask the author to check its visibility."
          action={
            <Button as={Link} to="/interactives" variant="primary">
              Browse interactives
            </Button>
          }
        />
      );
    }
    return (
      <MessageView
        icon={<IconAlertTriangle size={32} />}
        title="This activity couldn't be loaded"
        description="Something went wrong on our end. Try again in a moment."
        action={
          <Button variant="primary" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const pageURL = `${window.location.origin}/interactive/${activity.activityID}`;
  const typeName = getContentTypeName(activity);
  const typeIcon = getContentTypeIcon(activity.library);
  const rows = buildDetailRows(activity);
  const embedCode = embedOrigin
    ? buildActivityEmbedCode(embedOrigin, activity.h5pContentID, activity.title)
    : "";
  const actions = (size: "md" | "lg") => (
    <PublicActions
      pageURL={pageURL}
      onEmbed={() => setEmbedOpen(true)}
      embedAvailable={Boolean(embedOrigin)}
      size={size}
    />
  );
  const playerCard = (
    <Card padding="sm">
      <Stack direction="vertical" gap="sm">
        {isDesktop && <Heading level={2}>Activity</Heading>}
        <Player activity={activity} origin={embedOrigin} />
      </Stack>
    </Card>
  );

  return (
    <>
      <PageBreadcrumb current={activity.title} />
      {activity.viewerRole && (
        <div className={isDesktop ? "px-6 pt-6" : "px-4 pt-4"}>
          <ViewerAccessNotice activity={activity} />
        </div>
      )}
      {isDesktop ? (
        <div className="grid grid-cols-[400px_minmax(0,1fr)] gap-6 p-6">
          <Card padding="sm" className="self-start">
            <Stack direction="vertical" gap="md">
              <ContentTypeTile icon={typeIcon} size="lg" />
              <Heading level={1} className="text-center break-words">
                {activity.title}
              </Heading>
              {rows.length > 0 && <DetailsList rows={rows} />}
              <Tags tags={activity.tags} />
              <CopySections activity={activity} headingLevel={2} size="sm" />
              <div className="border-t border-neutral-200 pt-4">{actions("md")}</div>
            </Stack>
          </Card>
          <Stack direction="vertical" gap="md">
            <Summary description={activity.description} />
            {playerCard}
          </Stack>
        </div>
      ) : (
        // Mobile order: title, summary, player, actions, details.
        <Stack direction="vertical" gap="md" className="p-4">
          <Stack direction="vertical" gap="xs">
            {typeName && (
              <div>
                <Badge label={typeName} variant="primary" size="sm" />
              </div>
            )}
            <Heading level={1} className="break-words">
              {activity.title}
            </Heading>
          </Stack>
          <Summary description={activity.description} />
          {playerCard}
          {actions("lg")}
          <Card padding="sm">
            <Stack direction="vertical" gap="md">
              <Heading level={2}>Details</Heading>
              {rows.length > 0 && <DetailsList rows={rows} />}
              <Tags tags={activity.tags} />
              <CopySections activity={activity} headingLevel={3} size="md" />
            </Stack>
          </Card>
        </Stack>
      )}
      {embedOrigin && (
        <EmbedDialog open={embedOpen} onClose={() => setEmbedOpen(false)} code={embedCode} />
      )}
    </>
  );
};

export default CommonsActivityPage;
