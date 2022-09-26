import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Icon, List } from 'semantic-ui-react';
import './TreeView.css';

/**
 * Displays items in a "tree" view, with nested and expandable lists.
 */
const TreeNode = ({ parentKey, item, asLink, hrefKey, textKey }) => {

    const [expanded, setExpanded] = useState(false);
    let hasChildren = Array.isArray(item.children) && item.children.length > 0;

    let display = null;
    let styleObj = {};
    if (item.color) styleObj = { color: item.color };
    if (asLink) {
        if (typeof(item.metaLink) === 'object') {
            display = (
                <span>
                    <a href={item[hrefKey]} target='_blank' rel='noopener noreferrer' style={styleObj}>{item[textKey]}</a> — <a href={item.metaLink.url} rel='noopener noreferrer' target='_blank' style={styleObj}>{item.metaLink.text}</a>
                </span>
            )
        } else if (typeof(item.meta) === 'object') {
            display = <span><a href={item[hrefKey]} target='_blank' rel='noopener noreferrer' style={styleObj}>{item[textKey]}</a> — <span style={styleObj}>{item.meta.text}</span></span>
        } else {
            display = <span><a href={item[hrefKey]} target='_blank' rel='noopener noreferrer' style={styleObj}>{item[textKey]}</a></span>
        }
    } else {
        display = <span>{item.title}</span>
    }

    return (
        <List.Item>
            <Icon
                name={hasChildren ? (expanded ? 'caret down' : 'caret right') : 'circle'}
                size={hasChildren ? undefined : 'tiny'}
                onClick={(_e) => setExpanded(!expanded)}
                className={hasChildren ? 'cursor-pointer' : 'treenode-child-icon'}
            />
            <List.Content>
                <List.Header>{display}</List.Header>
                {(hasChildren && expanded) &&
                    <List.List>
                        {item.children.map((subItem, idx) => {
                            return (
                                <TreeNode
                                    key={`tree-node-${parentKey}-${idx}`}
                                    parentKey={idx}
                                    itemKey={subItem.id}
                                    item={subItem}
                                    asLink={asLink}
                                    hrefKey={hrefKey}
                                    textKey={textKey}
                                />
                            )
                        })}
                    </List.List>
                }
            </List.Content>
        </List.Item>
    )
};


const TreeView = ({ items, asLinks, hrefKey, textKey }) => {
    if (Array.isArray(items)) {
        if ((asLinks === true && typeof(hrefKey) === 'string' && typeof(textKey) === 'string') || asLinks === false) {
            return (
                <List relaxed>
                    {items.map((item, idx) => {
                        return (
                            <TreeNode
                                key={`tree-node-${idx}`}
                                parentKey={idx}
                                item={item}
                                asLink={asLinks}
                                hrefKey={hrefKey}
                                textKey={textKey}
                            />
                        )
                    })}
                </List>
            )
        }
    }
    return null;
};

TreeView.propTypes = {
    items: PropTypes.arrayOf(PropTypes.object),
    asLinks: PropTypes.bool,
    hrefKey: PropTypes.string,
    textKey: PropTypes.string,
};

TreeView.defaultProps = {
    items: null,
    asLinks: false,
    hrefKey: null,
    textKey: null
};

export default TreeView;
