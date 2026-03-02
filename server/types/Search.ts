export type FilterValue =
    | string
    | number
    | boolean
    | null
    | string[]
    | number[]
    | FilterOperators;

export type FilterOperators = {
    $eq?: string | number | boolean;
    $ne?: string | number | boolean;
    $gt?: number;
    $gte?: number;
    $lt?: number;
    $lte?: number;
    $in?: (string | number | boolean)[];
    $exists?: boolean;
    $null?: boolean;
    $empty?: boolean;
};

export type FilterInput =
    | string // Raw filter string
    | FilterObject
    | FilterObject[]; // Array treated as implicit AND

export type FilterObject = {
    $and?: FilterInput[];
    $or?: FilterInput[];
    $not?: FilterInput;
    [field: string]: FilterValue | FilterInput[] | FilterInput | undefined;
};
