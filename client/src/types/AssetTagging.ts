import { GenericKeyTextValueObj, MongoBaseDocument } from "./Misc";

export type AssetTagKey = {
  orgID: string;
  title: string;
  hex: string;
};

export type AssetTagValue = string | number | boolean | Date | string[];

interface AssetTagBase {
  uuid: string;
  value?: AssetTagValue;
  framework?: string | AssetTagFramework;
}

export interface AssetTag extends AssetTagBase {
  key: string;
}

export interface AssetTagWithKey extends AssetTagBase {
  key: AssetTagKey;
}

export type AssetTagTemplateValueType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "dropdown"
  | "multiselect";

// Frameworks have a list of 'template' tags that are used to create tags for assets
export interface AssetTagTemplate extends MongoBaseDocument {
  valueType: AssetTagTemplateValueType;
  defaultValue?: string | number | boolean | Date;
  options?: string[];
  isDeleted: boolean;
  key: string | AssetTagKey
  enabledAsFilter?: boolean;
}

export interface AssetTagFramework extends MongoBaseDocument {
  uuid: string;
  name: string;
  description: string;
  orgID: string;
  enabled: boolean;
  templates: AssetTagTemplate[];
}

export interface AssetTagFrameworkWithCampusDefault extends AssetTagFramework {
  isCampusDefault?: boolean;
}

export const AssetTagTemplateValueTypeOptions: GenericKeyTextValueObj<string>[] =
  [
    {
      key: "text",
      text: "Text",
      value: "text",
    },
    {
      key: "number",
      text: "Number",
      value: "number",
    },
    {
      key: "date",
      text: "Date",
      value: "date",
    },
    {
      key: "boolean",
      text: "Boolean",
      value: "boolean",
    },
    {
      key: "dropdown",
      text: "Dropdown",
      value: "dropdown",
    },
    {
      key: "multiselect",
      text: "Multi-select",
      value: "multiselect",
    },
  ];
