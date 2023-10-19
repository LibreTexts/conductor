import { GenericKeyTextValueObj, MongoBaseDocument } from "./Misc";

export type AssetTagKey = {
  orgID: string;
  title: string;
  hex: string;
};

export type AssetTagValue = string | number | boolean | Date | string[];

interface AssetTagBase {
  uuid: string;
  value: AssetTagValue;
  framework?: string | AssetTagFramework;
  isDeleted: boolean;
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
interface AssetTagTemplateBase extends MongoBaseDocument {
  valueType: AssetTagTemplateValueType;
  defaultValue?: string | number | boolean | Date;
  options?: string[];
  isDeleted: boolean;
}

export interface AssetTagTemplate extends AssetTagTemplateBase {
  key: string;
}

export interface AssetTagTemplateWithKey extends AssetTagTemplateBase {
  key: AssetTagKey;
}

interface AssetTagFrameworkBase extends MongoBaseDocument {
  uuid: string;
  name: string;
  description: string;
  orgID: string;
  enabled: boolean;
}

export interface AssetTagFramework extends AssetTagFrameworkBase {
  templates: AssetTagTemplate[];
}

export interface AssetTagFrameworkWithKeys extends AssetTagFrameworkBase {
  templates: AssetTagTemplateWithKey[];
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
