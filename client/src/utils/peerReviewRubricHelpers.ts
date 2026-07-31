import { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import {
  CustomFormBlockType,
  CustomFormElement,
  CustomFormHeading,
  CustomFormPrompt,
  CustomFormTextBlock,
  PeerReviewRubric,
} from "../types";

export function parseAndSortRubricElements({
  getValueFn,
  onError,
}: {
  getValueFn: UseFormGetValues<PeerReviewRubric>;
  onError: (err: any) => void;
}): CustomFormElement[] {
  try {
    if (
      !Array.isArray(getValueFn("headings")) ||
      !Array.isArray(getValueFn("prompts")) ||
      !Array.isArray(getValueFn("textBlocks"))
    ) {
      throw new Error("Error parsing server data.");
    }

    const headings: CustomFormElement[] = getValueFn("headings").map((h) => ({
      ...h,
      uiType: "heading",
    }));
    const prompts: CustomFormElement[] = getValueFn("prompts").map((p) => ({
      ...p,
      uiType: "prompt",
    }));
    const textBlocks: CustomFormElement[] = getValueFn("textBlocks").map(
      (t) => ({ ...t, uiType: "textBlock" })
    );

    return [...headings, ...prompts, ...textBlocks].sort(
      (a, b) => a.order - b.order
    );
  } catch (err) {
    onError(err);
    return [];
  }
}

const _moveBlocks = (
  arr: CustomFormBlockType[],
  blockToMove: CustomFormBlockType,
  direction: "up" | "down"
) => {
  return arr.map((item) => {
    if (direction === "up") {
      if (item.order === blockToMove.order - 1) {
        return { ...item, order: item.order + 1 };
      } else if (item.order === blockToMove.order) {
        return { ...item, order: item.order - 1 };
      }
    } else if (direction === "down") {
      if (item.order === blockToMove.order + 1) {
        return { ...item, order: item.order - 1 };
      } else if (item.order === blockToMove.order) {
        return { ...item, order: item.order + 1 };
      }
    }
    return item;
  });
};

const _deleteBlockAndReorder = <T extends { order: number }>(
  arr: T[],
  removeOrder: number
): T[] => {
  const filtered = arr.filter((item) => item.order !== removeOrder);
  return filtered.map((item) => {
    if (item.order > removeOrder) {
      return { ...item, order: item.order - 1 };
    }
    return item;
  });
};

/**
 * Changes a block's order in state and shifts nearby blocks to maintain ordering.
 */
export const handleMoveRubricBlock = ({
  blockToMove,
  direction,
  getValueFn,
  setValueFn,
  onError,
  onFinish,
}: {
  blockToMove: CustomFormBlockType;
  direction: "up" | "down";
  getValueFn: UseFormGetValues<PeerReviewRubric>;
  setValueFn: UseFormSetValue<PeerReviewRubric>;
  onError: (err: any) => void;
  onFinish?: () => void;
}) => {
  try {
    const MAX_ORDER = [
      ...getValueFn("headings"),
      ...getValueFn("prompts"),
      ...getValueFn("textBlocks"),
    ].length;

    if (
      (blockToMove.order === 1 && direction === "up") ||
      (blockToMove.order === MAX_ORDER && direction === "down")
    ) {
      return;
    }

    const headings = _moveBlocks(
      [...getValueFn("headings")],
      blockToMove,
      direction
    );
    const textBlocks = _moveBlocks(
      [...getValueFn("textBlocks")],
      blockToMove,
      direction
    );
    const prompts = _moveBlocks(
      [...getValueFn("prompts")],
      blockToMove,
      direction
    );

    setValueFn("headings", headings as CustomFormHeading[]);
    setValueFn("textBlocks", textBlocks as CustomFormTextBlock[]);
    setValueFn("prompts", prompts as CustomFormPrompt[]);

    if (onFinish) onFinish();
  } catch (err) {
    onError(err);
  }
};

/**
 * Removes a block from state and shifts nearby blocks to maintain ordering.
 */
export const handleDeleteRubricBlock = ({
  dbBlock,
  setValueFn,
  getValueFn,
  onError,
  onStart,
  onFinish,
}: {
  dbBlock?: CustomFormElement;
  setValueFn: UseFormSetValue<PeerReviewRubric>;
  getValueFn: UseFormGetValues<PeerReviewRubric>;
  onError: (err: any) => void;
  onStart?: () => void;
  onFinish?: () => void;
}) => {
  try {
    if (!dbBlock) return;
    if (onStart) onStart();

    setValueFn(
      "headings",
      _deleteBlockAndReorder(getValueFn("headings"), dbBlock.order)
    );
    setValueFn(
      "textBlocks",
      _deleteBlockAndReorder(getValueFn("textBlocks"), dbBlock.order)
    );
    setValueFn(
      "prompts",
      _deleteBlockAndReorder(getValueFn("prompts"), dbBlock.order)
    );

    if (onFinish) onFinish();
  } catch (err) {
    onError(err);
  }
};
