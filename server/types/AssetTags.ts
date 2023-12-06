import { AssetTagInterface } from "../models/assettag";
import { AssetTagFrameworkInterface } from "../models/assettagframework";
import { AssetTagKeyInterface } from "../models/assettagkey";

export type AssetTagWithFramework = AssetTagInterface & {
  framework?: string | AssetTagFrameworkInterface;
};

export type AssetTagWithFrameworkAndKey = AssetTagWithFramework & {
  key?: string | AssetTagKeyInterface;
};

export type AssetTagTemplateWithKey = AssetTagInterface & {
  key: AssetTagKeyInterface
}