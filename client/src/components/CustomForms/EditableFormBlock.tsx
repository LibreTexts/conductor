import { Segment, Label, Button, Icon, SegmentProps } from "semantic-ui-react";
import {
  isCustomFormHeadingOrTextBlock,
  isCustomFormPromptBlock,
} from "../../utils/typeHelpers";
import { CustomFormElement } from "../../types";
import { getFriendlyUIType } from "../../utils/customFormHelpers";

interface EditableFormBlockProps extends SegmentProps {
  item: CustomFormElement;
  onMove: (item: CustomFormElement, direction: "up" | "down") => void;
  onRequestEdit: (order: number) => void;
  onRequestDelete: (order: number) => void;
}

const EditableFormBlock: React.FC<EditableFormBlockProps> = ({
  item,
  onMove,
  onRequestEdit,
  onRequestDelete,
  ...rest
}) => {
  const { disabled } = rest;
  return (
    <Segment {...rest}>
      <Label attached="top left" className="peerreview-rubricedit-label">
        <Button.Group size="tiny">
          <Button
            icon="arrow up"
            onClick={() => onMove(item, "up")}
            disabled={disabled}
          />
          <Button
            icon="arrow down"
            onClick={() => onMove(item, "down")}
            disabled={disabled}
          />
        </Button.Group>
        <span className="ml-1r">
          <strong>#{item.order}:</strong> {getFriendlyUIType(item.uiType)}
        </span>
      </Label>
      <div className="flex-row-div">
        <div className="left-flex">
          {isCustomFormHeadingOrTextBlock(item)
            ? item.text
            : isCustomFormPromptBlock(item)
            ? item.promptText
            : ""}
        </div>
        <div className="right-flex">
          <Button.Group>
            <Button
              className="peerreview-rubricedit-editblockbtn"
              color="teal"
              onClick={() => onRequestEdit(item.order)}
              disabled={disabled}
            >
              <Icon name="pencil" />
              Edit {getFriendlyUIType(item.uiType)}
            </Button>
            <Button
              color="red"
              onClick={() => onRequestDelete(item.order)}
              disabled={disabled}
            >
              <Icon name="trash" />
              Delete
            </Button>
          </Button.Group>
        </div>
      </div>
    </Segment>
  );
};

export default EditableFormBlock;
