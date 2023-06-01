import {
  Modal,
  Form,
  Button,
  Icon,
  Input,
  List,
  Popup,
  Header,
  ModalProps,
} from "semantic-ui-react";
import { CustomFormPromptType, GenericKeyTextValueObj } from "../../types";
import { customFormPromptTypes } from "./CustomFormPromptTypes";

interface PromptModalProps extends ModalProps {
  show: boolean;
  mode: "add" | "edit";
  promptType: string;
  promptText: string;
  promptReq: boolean;
  dropdownOptions: GenericKeyTextValueObj<string>[];
  newOptionValue: string;
  promptTypeError: boolean;
  textError: boolean;
  dropdownError: boolean;
  onChangePromptText: (newVal: string) => void;
  onChangePromptReq: (newVal: boolean) => void;
  onChangeNewOptionValue: (newVal: string) => void;
  onChangePromptType: (newVal: CustomFormPromptType) => void;
  onAddDropdownPromptOption: () => void;
  onMoveDropdownPromptOption: (idx: number, direction: "up" | "down") => void;
  onDeleteDropdownPromptOption: (idx: number) => void;
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
}
const PromptModal: React.FC<PromptModalProps> = ({
  show,
  mode,
  promptType,
  promptText,
  promptReq,
  dropdownOptions,
  newOptionValue,
  promptTypeError,
  textError,
  dropdownError,
  onChangePromptText,
  onChangePromptReq,
  onChangeNewOptionValue,
  onChangePromptType,
  onAddDropdownPromptOption,
  onMoveDropdownPromptOption,
  onDeleteDropdownPromptOption,
  onSave,
  onClose,
  loading,
  ...rest
}) => {
  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>{mode === "add" ? "Add" : "Edit"} Prompt</Modal.Header>
      <Modal.Content>
        <Form noValidate>
          <Form.Select
            options={customFormPromptTypes}
            value={promptType}
            onChange={(_e, { value }) =>
              onChangePromptType(value as CustomFormPromptType)
            }
            placeholder="Prompt Type..."
            label="Prompt Type"
            fluid
            selection
            error={promptTypeError}
          />
          {promptType !== "" && (
            <>
              <Form.Input
                type="text"
                value={promptText}
                onChange={(_e, { value }) => onChangePromptText(value)}
                fluid
                label="Prompt Text"
                placeholder="Enter prompt/instructions/question..."
                error={textError}
              />
              <Form.Group inline>
                <label>Response Required?</label>
                <Form.Radio
                  label="Yes"
                  checked={promptReq === true}
                  onChange={(_e, _data) => onChangePromptReq(true)}
                />
                <Form.Radio
                  label="No"
                  checked={promptReq === false}
                  onChange={(_e, _data) => onChangePromptReq(false)}
                />
              </Form.Group>
              {promptType === "dropdown" && (
                <>
                  <Header size="tiny" as="span">
                    Dropdown Options{" "}
                    <span className="muted-text">(up to 25)</span>
                  </Header>
                  <List divided>
                    {dropdownOptions.map((item, idx) => {
                      return (
                        <List.Item key={idx}>
                          <div className="flex-row-div">
                            <div className="left-flex">
                              <span>{item.text}</span>
                            </div>
                            <div className="right-flex">
                              <Button.Group>
                                <Popup
                                  trigger={
                                    <Button
                                      icon
                                      onClick={() =>
                                        onMoveDropdownPromptOption(idx, "up")
                                      }
                                    >
                                      <Icon name="arrow up" />
                                    </Button>
                                  }
                                  position="top center"
                                  content="Move Up"
                                />
                                <Popup
                                  trigger={
                                    <Button
                                      icon
                                      onClick={() =>
                                        onMoveDropdownPromptOption(idx, "down")
                                      }
                                    >
                                      <Icon name="arrow down" />
                                    </Button>
                                  }
                                  position="top center"
                                  content="Move Down"
                                />
                                <Popup
                                  trigger={
                                    <Button
                                      icon
                                      color="red"
                                      onClick={() =>
                                        onDeleteDropdownPromptOption(idx)
                                      }
                                    >
                                      <Icon name="trash" />
                                    </Button>
                                  }
                                  position="top center"
                                  content="Remove"
                                />
                              </Button.Group>
                            </div>
                          </div>
                        </List.Item>
                      );
                    })}
                    {dropdownOptions.length < 25 && (
                      <List.Item key="new">
                        <Input
                          type="text"
                          value={newOptionValue}
                          onChange={(_e, { value }) =>
                            onChangeNewOptionValue(value)
                          }
                          placeholder="Enter option text..."
                          action={{
                            color: "green",
                            labelPosition: "right",
                            icon: "add",
                            content: "Add Option",
                            onClick: onAddDropdownPromptOption,
                          }}
                          fluid
                          error={dropdownError}
                          className="mt-2p"
                        />
                      </List.Item>
                    )}
                  </List>
                </>
              )}
            </>
          )}
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" loading={loading ?? false} onClick={onSave}>
          <Icon name={mode === "add" ? "add" : "save"} />
          {mode === "add" ? "Add" : "Save"} Prompt
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default PromptModal;
