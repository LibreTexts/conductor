import { Control, FieldArrayWithId, UseFormSetValue } from "react-hook-form";
import { Prettify, TableOfContentsDetailed } from "../../../types";
import React, { useMemo } from "react";
import { DISABLED_PAGE_TAG_PREFIXES } from "../../../utils/misc";
import { Link } from "react-router-dom";
import CtlTextArea from "../../ControlledInputs/CtlTextArea";
import { Button, Icon, Label, LabelDetail } from "semantic-ui-react";

type WithUIState = Prettify<
  Omit<TableOfContentsDetailed, "children"> & {
    expanded: boolean;
    loading: boolean;
    edited: boolean;
    isRoot: boolean;
    children: WithUIState[];
  }
>;

type FormWorkingData = {
  pages: {
    pageID: string;
    overview: string;
    tags: string[];
  }[];
};

interface NodeEditorProps {
  node: WithUIState;
  indentLevel?: number;
  control: Control<FormWorkingData, any>;
  fields: FieldArrayWithId<FormWorkingData, "pages", "id">[];
  tags: string[];
  onRemoveSingleTag: (pageID: string, tag: string) => void;
  onRemoveAllOccurrences: (tag: string) => void;
  onAddSingleTag: (pageID: string) => void;
  onUpdateSummary: (pageID: string, summary: string) => void;
  onFetchAITags: (pageID: string) => void;
  onFetchAISummary: (pageID: string) => void;
}

const isDisabledTag = (value: string): boolean => {
  return DISABLED_PAGE_TAG_PREFIXES.some((prefix) =>
    value?.toString().startsWith(prefix)
  );
};

const filterDisabledTags = (arr: string[]): string[] => {
  return arr.filter((tag) => !isDisabledTag(tag));
};

const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  indentLevel = 1,
  control,
  fields,
  tags: propTags,
  onRemoveSingleTag,
  onRemoveAllOccurrences,
  onAddSingleTag,
  onUpdateSummary,
  onFetchAISummary,
  onFetchAITags,
}) => {
  const field = fields.find((f) => f.pageID === node.id);
  const fieldIdx = fields.findIndex((f) => f.pageID === node.id);
  if (!field) return null;

  const hasChildren = node.children && node.children.length !== 0;
  const tags = useMemo(() => filterDisabledTags(propTags), [propTags]);

  const getIndent = () => {
    if (indentLevel <= 2) return "!ml-4";
    if (indentLevel === 3 && !hasChildren) return "!ml-4";
    if (indentLevel === 3 && hasChildren) return "!ml-12";
    return `!ml-${indentLevel * 3}`;
  };

  const indent = getIndent();

  const TagLabel = ({
    pageID,
    tag,
    disabled,
  }: {
    pageID: string;
    tag: string;
    disabled?: boolean;
  }) => {
    return (
      <Label
        key={crypto.randomUUID()}
        style={{
          backgroundColor: "#155789",
        }}
        className={`cursor-pointer !text-white ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <Icon
          name="remove"
          onClick={(e: any) => {
            if (disabled) return;
            e.preventDefault && e.preventDefault();
            onRemoveSingleTag(pageID, tag);
          }}
        />
        {tag}
        <LabelDetail className="!text-white">
          <Icon
            name="trash alternate outline"
            className=""
            onClick={(e: any) => {
              if (disabled) return;
              e.preventDefault && e.preventDefault();
              onRemoveAllOccurrences(tag);
            }}
          />
        </LabelDetail>
      </Label>
    );
  };

  return (
    <div
      key={field.id}
      className={`flex flex-col border-slate-300 border rounded-md p-4 shadow-sm bg-gray-50/60 ${indent} max-h-96`}
    >
      <Link to={node.url} target="_blank" className="font-semibold">
        {node.title}
      </Link>
      <div className="flex flex-row justify-between items-stretch max-h-96 mt-2">
        <div className="flex flex-col w-4/6 border-r border-slate-500 pr-4 mr-4 h-full">
          <p className="text-base mt-1 font-semibold">Summary:</p>
          <div className="flex flex-col justify-between items-start">
            <CtlTextArea
              control={control}
              name={`pages.${fieldIdx}.overview`}
              className="!w-full mt-0.5"
              fluid
              bordered
              showRemaining
              rows={4}
              maxLength={500}
              disabled={node.loading}
              placeholder="Enter a page summary here..."
              onChange={(e) => {
                // Need to manually handle onChange here so we can set the edited state
                // @ts-ignore
                onUpdateSummary(node.id, e.target.value);
              }}
            />
          </div>
        </div>
        <div className="flex flex-col w-2/6 max-h-96 overflow-y-auto">
          <p className="text-base font-semibold">Tags:</p>
          <div
            className={`flex flex-col flex-grow h-full overflow-y-auto border border-slate-500 rounded-md p-2 bg-white mt-0.5 ${
              node.loading ? "opacity-50 cursor-not-allowed" : ""
            } `}
          >
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {tags.map((t) => (
                <TagLabel pageID={node.id} tag={t} disabled={node.loading} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-row justify-between w-full">
        <div className="flex flex-row w-4/6 border-r border-slate-500 pr-4 mr-4 pt-4">
          <Button
            loading={node.loading}
            style={{ backgroundColor: "#155789" }}
            className="!text-white"
            onClick={() => onFetchAISummary(node.id)}
            title="Generate AI Summary"
          >
            <Icon name="magic" />
            Generate Summary
          </Button>
        </div>
        <div className="flex flex-row w-2/6 pt-4">
          <Button
            style={{ backgroundColor: "#155789" }}
            className="!text-white"
            onClick={() => onFetchAITags(node.id)}
            loading={node.loading}
            title="Generate AI Tags"
          >
            <Icon name="magic" />
            Generate Tags
          </Button>
          <Button
            style={{ backgroundColor: "#155789" }}
            className="!text-white"
            onClick={() => {
              onAddSingleTag(node.id);
              //   handleOpenSingleAddTagModal(node.id);
            }}
            loading={node.loading}
            title="Add Individual Tag to Page"
          >
            <Icon name="plus" />
            Add Tag
          </Button>
        </div>
      </div>
      <div className="flex flex-row justify-end w-full">
        {node.edited && <p className="text-xs mr-1">Edited | </p>}
        <p className="text-xs">ID: {node.id}</p>
      </div>
    </div>
  );
};

export default NodeEditor;
