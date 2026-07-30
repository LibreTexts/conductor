/**
 * WHEN NEW UI IS APPROVED REPLACE ControlPanel WITH THE CONTENTS OF THIS
 * FILE AND DELETE ControlPanelNewUITemp.tsx (this file)
 */
import { IconButton, Menu, Stack, Tooltip, type IconButtonProps } from "@libretexts/davis-react";
import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconPlus,
    IconTrash,
    IconChevronUp,
    IconChevronDown,
} from "@tabler/icons-react";

interface BookActionsProps {
    isNarrowScreen: boolean;
    onAddItem: () => void;
    onDeleteItem: () => void;
    onUndo: () => void;
    onRedo: () => void;
    isAllExpanded: boolean;
    onToggleExpandCollapse: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

type BookAction = {
    title: string;
    icon: React.ReactNode;
    variant: IconButtonProps['variant'];
    onClick: () => void;
    disabled?: boolean;
}

const BookActions: React.FC<BookActionsProps> = ({
    isNarrowScreen,
    onAddItem,
    onDeleteItem,
    onUndo,
    onRedo,
    isAllExpanded,
    onToggleExpandCollapse,
    canUndo,
    canRedo
}) => {

    const actions: BookAction[] = [
        {
            title: "Add",
            icon: <IconPlus size={16} />,
            variant: "primary",
            onClick: () => {
                onAddItem();
            }
        },
        {
            title: "Delete",
            icon: <IconTrash size={16} />,
            variant: "destructive",
            onClick: () => {
                onDeleteItem();
            }
        },
        {
            title: "Undo",
            icon: <IconArrowBackUp size={16} />,
            variant: "outline",
            disabled: !canUndo,
            onClick: () => {
                onUndo();
            }
        },
        {
            title: "Redo",
            icon: <IconArrowForwardUp size={16} />,
            variant: "outline",
            disabled: !canRedo,
            onClick: () => {
                onRedo();
            }
        },
        {
            title: isAllExpanded ? "Collapse all" : "Expand all",
            icon: isAllExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />,
            variant: "outline",
            onClick: () => {
                onToggleExpandCollapse();
            }
        }
    ]

    if (isNarrowScreen) {
        return (
            <Menu>
                <Menu.Button aria-label="Text Actions" >
                    Text Actions
                </Menu.Button>
                <Menu.Items>
                    {
                        actions.map((action, index) => (
                            <Menu.Item
                                key={index}
                                icon={action.icon}
                                onClick={action.onClick}
                                disabled={action.disabled ?? false}
                            >
                                {action.title}
                            </Menu.Item>
                        ))
                    }
                </Menu.Items>
            </Menu>
        )
    }

    return (
        <Stack direction="horizontal" gap="sm" justify="end" className="w-full" align="center">
            {
                actions.map((action, index) => (
                    <Tooltip key={index} content={action.title} placement="bottom">
                        <IconButton
                            aria-label={action.title}
                            variant={action.variant}
                            key={index}
                            icon={action.icon}
                            onClick={action.onClick}
                            disabled={action.disabled ?? false}
                        />
                    </Tooltip>
                ))
            }
        </Stack>
    )
}

export default BookActions;