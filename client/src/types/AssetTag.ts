import { GenericKeyTextValueObj, MongoBaseDocument } from "./Misc";

export type AssetTagValueType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "dropdown";

export interface AssetTag extends MongoBaseDocument {
  title: string;
  valueType: AssetTagValueType;
  defaultValue?: string | number | boolean | Date;
  options?: string[];
  isDeleted: boolean;
}

export interface AssetTagFramework extends MongoBaseDocument {
  uuid: string;
  name: string;
  description: string;
  orgID: string;
  tags: AssetTag[];
  enabled: boolean;
}

export const AssetTagValueTypeOptions: GenericKeyTextValueObj<string>[] = [
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
];