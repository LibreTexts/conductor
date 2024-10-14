import React, { useState } from "react";
import { Icon, List } from "semantic-ui-react";
import { TableOfContents } from "../../types";

interface TreeViewProps {
  items: TableOfContents[] | null;
  asLinks: boolean;
  hrefKey: string | null;
  textKey: string | null;
}

interface TreeNodeProps extends Omit<TreeViewProps, "items"> {
  parentKey: number;
  item: TableOfContents;
}

/**
 * Displays items in a "tree" view, with nested and expandable lists.
 */
const TreeNode: React.FC<TreeNodeProps> = ({
  parentKey,
  item,
  asLinks,
  hrefKey,
  textKey,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  let display = null;
  let styleObj = {};
  //if (item.color) styleObj = { color: item.color };
  if (asLinks && hrefKey && textKey) {
    // if (typeof(item.metaLink) === 'object') {
    //     display = (
    //         <span>
    //             <a href={item[hrefKey]} target='_blank' rel='noopener noreferrer' style={styleObj}>{item[textKey]}</a> — <a href={item.metaLink.url} rel='noopener noreferrer' target='_blank' style={styleObj}>{item.metaLink.text}</a>
    //         </span>
    //     )
    // } else if (typeof(item.meta) === 'object') {
    //     display = <span><a href={item[hrefKey]} target='_blank' rel='noopener noreferrer' style={styleObj}>{item[textKey]}</a> — <span style={styleObj}>{item.meta.text}</span></span>
    // } else {
    display = (
      <span>
        <a
          //@ts-ignore
          href={item[hrefKey]}
          target="_blank"
          rel="noopener noreferrer"
          style={styleObj}
        >
          {/** @ts-ignore */}
          {item[textKey]}
        </a>
      </span>
    );
  } else {
    display = <span>{item.title}</span>;
  }

  return (
    <List.Item>
      <Icon
        name={
          hasChildren ? (expanded ? "caret down" : "caret right") : "circle"
        }
        size={hasChildren ? undefined : "tiny"}
        onClick={() => setExpanded(!expanded)}
        className={hasChildren ? "cursor-pointer" : "!align-middle"}
      />
      <List.Content>
        <List.Header>{display}</List.Header>
        {hasChildren && expanded && (
          <List.List>
            {item.children.map((subItem, idx) => {
              return (
                <TreeNode
                  key={`tree-node-${parentKey}-${idx}`}
                  parentKey={idx}
                  item={subItem}
                  asLinks={asLinks}
                  hrefKey={hrefKey}
                  textKey={textKey}
                />
              );
            })}
          </List.List>
        )}
      </List.Content>
    </List.Item>
  );
};

const TreeView: React.FC<TreeViewProps> = ({
  items,
  asLinks,
  hrefKey,
  textKey,
}) => {
  if (!Array.isArray(items)) return <List relaxed />;
  if (
    (asLinks === true &&
      typeof hrefKey === "string" &&
      typeof textKey === "string") ||
    asLinks === false
  ) {
    return (
      <List relaxed>
        {items.map((item, idx) => {
          return (
            <TreeNode
              key={`tree-node-${idx}`}
              parentKey={idx}
              item={item}
              asLinks={asLinks}
              hrefKey={hrefKey}
              textKey={textKey}
            />
          );
        })}
      </List>
    );
  }
  
  return <List relaxed />;
};

export default TreeView;
