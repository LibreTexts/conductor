import React, { useState, useEffect, useId } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { Link } from "@libretexts/davis-react";
import { TableOfContents } from "../../types";

interface TreeViewProps {
  items: TableOfContents[] | null;
  asLinks: boolean;
  hrefKey: string | null;
  textKey: string | null;
  expandAll?: boolean;
}

interface TreeNodeProps extends Omit<TreeViewProps, "items"> {
  item: TableOfContents;
}

/**
 * A single node in the tree. Branch nodes expose a native <button> disclosure
 * toggle (keyboard-operable, with aria-expanded / aria-controls) and render
 * their children in a nested <ol>. Leaf nodes render the link/label only.
 */
const TreeNode: React.FC<TreeNodeProps> = ({
  item,
  asLinks,
  hrefKey,
  textKey,
  expandAll,
}) => {
  const [expanded, setExpanded] = useState(expandAll ?? false);
  const panelId = useId();

  useEffect(() => {
    if (typeof expandAll === "boolean") {
      setExpanded(expandAll);
    }
  }, [expandAll]);

  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  const asLinkNode = asLinks && !!hrefKey && !!textKey;
  const label = asLinkNode
    ? (item[textKey as keyof TableOfContents] as string)
    : item.title;

  const display = asLinkNode ? (
    // Davis Link for consistent styling/behavior; underline="always" keeps the
    // link distinguished by more than color (SC 1.4.1), and `external` adds the
    // new-tab target, icon, and an sr-only "(opens in new tab)" announcement.
    <Link
      href={item[hrefKey as keyof TableOfContents] as string}
      external
      underline="always"
    >
      {label}
    </Link>
  ) : (
    <span>{item.title}</span>
  );

  return (
    <li>
      <div className="flex items-start gap-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
            className="inline-flex min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {/* Caret is a real SVG, not a CSS ::before glyph — SC 1.3.1 (item 4) */}
            {expanded ? (
              <IconChevronDown size={18} aria-hidden="true" />
            ) : (
              <IconChevronRight size={18} aria-hidden="true" />
            )}
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
          </span>
        )}
        <span className="pt-0.5">{display}</span>
      </div>
      {hasChildren && (
        // Nested ordered list — programmatic list structure (item 2). Kept in
        // the DOM and toggled with `hidden` so aria-controls always resolves.
        <ol id={panelId} hidden={!expanded} className="ml-6 list-none">
          {item.children.map((subItem) => (
            <TreeNode
              key={subItem.id ?? subItem.title}
              item={subItem}
              asLinks={asLinks}
              hrefKey={hrefKey}
              textKey={textKey}
              expandAll={expandAll}
            />
          ))}
        </ol>
      )}
    </li>
  );
};

/**
 * Displays items in an expandable "tree" view built from semantic ordered
 * lists with disclosure buttons. Replaces the legacy Semantic UI List/Icon
 * implementation to meet WCAG 2.2 AA (SC 1.3.1, 1.4.1, 2.1.1).
 */
const TreeView: React.FC<TreeViewProps> = ({
  items,
  asLinks,
  hrefKey,
  textKey,
  expandAll,
}) => {
  if (!Array.isArray(items)) return <ol className="list-none" />;

  const propsValid =
    (asLinks === true &&
      typeof hrefKey === "string" &&
      typeof textKey === "string") ||
    asLinks === false;

  if (!propsValid) return <ol className="list-none" />;

  return (
    <ol className="list-none">
      {items.map((item) => (
        <TreeNode
          key={item.id ?? item.title}
          item={item}
          asLinks={asLinks}
          hrefKey={hrefKey}
          textKey={textKey}
          expandAll={expandAll}
        />
      ))}
    </ol>
  );
};

export default TreeView;
