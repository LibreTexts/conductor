import {
  CustomFormUIType,
  CustomFormBlockType,
  OrgEvent,
  CustomFormHeading,
  CustomFormPrompt,
  CustomFormTextBlock,
  CustomFormElement,
} from "../types";
import { UseFormGetValues, UseFormSetValue } from "react-hook-form";
import { isCustomFormPromptBlock } from "./typeHelpers";
import { isEmptyString } from "../components/util/HelperFunctions";
import { OrgEventParticipantFormResponse } from "../types";
export function getFriendlyUIType(uiType: CustomFormUIType) {
  return uiType === "heading"
    ? "Heading"
    : uiType === "prompt"
    ? "Prompt"
    : "Text Block";
}

export function parseAndSortElements({
  getValueFn,
  onError,
}: {
  getValueFn: UseFormGetValues<OrgEvent>;
  onError: (err: any) => void;
}): CustomFormElement[] {
  try {
    let allElem: CustomFormElement[] = [];
    if (
      !Array.isArray(getValueFn("headings")) ||
      !Array.isArray(getValueFn("prompts")) ||
      !Array.isArray(getValueFn("textBlocks"))
    ) {
      throw new Error("Error parsing server data.");
    }

    const headings: CustomFormElement[] = getValueFn("headings").map((h) => {
      return {
        ...h,
        uiType: "heading",
      };
    });

    const prompts: CustomFormElement[] = getValueFn("prompts").map((p) => {
      return {
        ...p,
        uiType: "prompt",
      };
    });

    const textBlocks: CustomFormElement[] = getValueFn("textBlocks").map(
      (t) => {
        return {
          ...t,
          uiType: "textBlock",
        };
      }
    );

    allElem = [...headings, ...prompts, ...textBlocks];

    allElem.sort((a, b) => {
      let aOrder = a.order;
      let bOrder = b.order;
      if (typeof aOrder !== "number") aOrder = 1;
      if (typeof bOrder !== "number") bOrder = 1;
      if (aOrder < bOrder) return -1;
      if (aOrder > bOrder) return 1;
      return 0;
    });

    return allElem;
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
        // moving block up, block above needs to move down
        return {
          ...item,
          order: item.order + 1,
        };
      } else if (item.order === blockToMove.order) {
        return {
          ...item,
          order: item.order - 1,
        };
      }
    } else if (direction === "down") {
      if (item.order === blockToMove.order + 1) {
        // moving block down, block below needs to move up
        return {
          ...item,
          order: item.order - 1,
        };
      } else if (item.order === blockToMove.order) {
        return {
          ...item,
          order: item.order + 1,
        };
      }
    }
    return item; // leave other blocks alone
  });
};

const _reorderBlocks = <T extends { order: number }>(
  arr: T[],
  removedIdx: number
): T[] => {
  return arr.map((item) => {
    if (!item) return item;
    if (!item.order) return item;
    if (item.order >= removedIdx) {
      // blocks below need to be moved up
      return {
        ...item,
        order: item.order - 1,
      };
    }
    return item;
  });
};

/**
 * Changes a block's order in state and shifts nearby blocks to maintain ordering.
 * @param {Object} blockToMove - The block's current state.
 * @param {String} direction - The direction to move the block in the rubric.
 * @param {Function} getValueFn - React Hook Form getter function
 * @param {Function} setValueFn - React Hook Form setter function
 * @param {Function} onError - Erorr handler
 * @param {Function} onFinish - Optional function that runs whenever block is moved
 */
export const handleMoveBlock = ({
  blockToMove,
  direction,
  getValueFn,
  setValueFn,
  onError,
  onFinish,
}: {
  blockToMove: CustomFormBlockType;
  direction: "up" | "down";
  getValueFn: UseFormGetValues<OrgEvent>;
  setValueFn: UseFormSetValue<OrgEvent>;
  onError: (err: any) => void;
  onFinish?: () => void;
}) => {
  try {
    // don't move a block already at the top/bottom
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

    /* move the blocks */
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

    if (onFinish) {
      onFinish();
    }
  } catch (err) {
    onError(err);
  }
};

/**
 * Removes a block from state and shifts nearby blocks to maintain ordering.
 * @param {Object} dbBlock - The block to delete.
 * @param {Function} getValueFn - React Hook Form getter function
 * @param {Function} setValueFn - React Hook Form setter function
 * @param {Function} onError - Error handler
 * @param {Function} onStart - Optional function that runs whenever execution starts
 * @param {Function} onFinish - Optional function that runs whenever execution ends
 */
export const handleDeleteBlock = ({
  dbBlock,
  setValueFn,
  getValueFn,
  onError,
  onStart,
  onFinish,
}: {
  dbBlock?: CustomFormElement;
  setValueFn: UseFormSetValue<OrgEvent>;
  getValueFn: UseFormGetValues<OrgEvent>;
  onError: (err: any) => void;
  onStart?: () => void;
  onFinish?: () => void;
}) => {
  try {
    if (!dbBlock) return;
    if (onStart) {
      onStart();
    }

    let deleteIdx;

    if (dbBlock.uiType === "heading") {
      deleteIdx = getValueFn("headings").findIndex(
        (item) => item.order === dbBlock.order
      );

      if (deleteIdx === -1) return;

      const newArr = [...getValueFn("headings")];
      newArr.splice(deleteIdx, 1);
      setValueFn("headings", _reorderBlocks(newArr, dbBlock.order));
    }

    if (dbBlock.uiType === "textBlock") {
      deleteIdx = getValueFn("textBlocks").findIndex(
        (item) => item.order === dbBlock.order
      );
      if (deleteIdx === -1) return;

      const newArr = [...getValueFn("textBlocks")];
      newArr.splice(deleteIdx, 1);
      setValueFn("textBlocks", _reorderBlocks(newArr, dbBlock.order));
    }

    if (dbBlock.uiType === "prompt") {
      deleteIdx = getValueFn("prompts").findIndex(
        (item) => item.order === dbBlock.order
      );
      if (deleteIdx === -1) return;

      const newArr = [...getValueFn("prompts")];
      newArr.splice(deleteIdx, 1);

      setValueFn("prompts", _reorderBlocks(newArr, dbBlock.order));
    }

    if (onFinish) {
      onFinish();
    }
  } catch (err) {
    onError(err);
  }
};

/**
 * Checks that all prompts have valid responses and updates their error state.
 * @returns {Boolean} True if form is valid, false otherwise.
 */
export const validatePromptResponses = (
  allElements: CustomFormElement[]
): boolean => {
  let valid = true;
  for (let i = 0; i < allElements.length; i++) {
    const item = allElements[i];
    if (!isCustomFormPromptBlock(item)) {
      continue;
    }

    // If prompt is required and no response, form is invalid
    if (item.promptRequired && !item.value) {
      valid = false;
      break;
    }

    // If prompt is optional and no response, skip
    if (!item.promptRequired && !item.value) {
      continue;
    }

    // If prompt has a response, check that it is valid
    if (item.value) {
      //Check that text responses are not too long regardless if optional or not
      if (item.promptType === "text" && item.value.toString().length > 10000) {
        valid = false;
        break;
      }

      const parsedVal = parseInt(item.value.toString());
      if (item.promptType === "3-likert" && (parsedVal < 1 || parsedVal > 3)) {
        valid = false;
        break;
      } else if (
        item.promptType === "5-likert" &&
        (parsedVal < 1 || parsedVal > 5)
      ) {
        valid = false;
        break;
      } else if (
        item.promptType === "7-likert" &&
        (parsedVal < 1 || parsedVal > 7)
      ) {
        valid = false;
        break;
      } else if (
        (item.promptType === "text" || item.promptType === "dropdown") &&
        isEmptyString(item.value.toString())
      ) {
        valid = false;
        break;
      } else if (item.promptType === "checkbox" && item.value !== true) {
        valid = false;
        break;
      }
    }
  }

  return valid;
};

/**
 * Takes array of all Custom Form elements, extracts responses from prompts
 * and returns them as an array of OrgEventParticipantFormResponses
 * @param {CustomFormElement[]} allElements - The array of form elements
 * @returns {OrgEventParticipantFormResponse[]} - The array of extracted responses
 */
export function extractPromptResponses(
  allElements: CustomFormElement[]
): OrgEventParticipantFormResponse[] {
  let responses: OrgEventParticipantFormResponse[] = [];
  for (let i = 0; i < allElements.length; i++) {
    let item = allElements[i];

    if (!isCustomFormPromptBlock(item)) {
      continue;
    }

    responses.push({
      promptNum: item.order,
      responseVal: item.value?.toString() ?? "",
    });
  }

  return responses;
}
