import { GenericKeyTextValueObj, MongoBaseDocument } from "./Misc";

export type AssetTagValue = string | number | boolean | Date | string[];

export type AssetTag = {
  uuid: string
  title: string;
  value: AssetTagValue;
  framework?: string | AssetTagFramework;
  isDeleted: boolean;
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
  title: string;
  valueType: AssetTagTemplateValueType;
  defaultValue?: string | number | boolean | Date;
  options?: string[];
  isDeleted: boolean;
}

export interface AssetTagFramework extends MongoBaseDocument {
  uuid: string;
  name: string;
  description: string;
  orgID: string;
  templates: AssetTagTemplate[];
  enabled: boolean;
}

export const AssetTagTemplateValueTypeOptions: GenericKeyTextValueObj<string>[] = [
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