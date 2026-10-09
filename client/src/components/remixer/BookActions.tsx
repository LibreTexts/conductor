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
    IconRestore,
    IconChevronUp,
    IconChevronDown,
} from "@tabler/icons-react";

interface BookActionsProps {
    isNarrowScreen: boolean;
    onAddItem: () => void;
    onDeleteItem: () => void;
    onRestoreItem: () => void;
    isSelectedItemDeleted: boolean;
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
    /** Editing actions render twice as wide to set them apart from view controls. */
    wide?: boolean;
}

const BookActions: React.FC<BookActionsProps> = ({
    isNarrowScreen,
    onAddItem,
    onDeleteItem,
    onRestoreItem,
    isSelectedItemDeleted,
    onUndo,
    onRedo,
    isAllExpanded,
    onToggleExpandCollapse,
    canUndo,
    canRedo
}) => {

    // Non-primary actions use "secondary": the Davis "outline" border is
    // below 3:1 contrast (pending Davis fix).
    const actions: BookAction[] = [
        {
            title: "Add",
            icon: <IconPlus size={18} />,
            variant: "primary",
            wide: true,
            onClick: () => {
                onAddItem();
            }
        },
        isSelectedItemDeleted ? {
            title: "Restore",
            icon: <IconRestore size={18} />,
            variant: "secondary",
            wide: true,
            onClick: () => {
                onRestoreItem();
            }
        } : {
            title: "Delete",
            icon: <IconTrash size={18} />,
            variant: "destructive",
            wide: true,
            onClick: () => {
                onDeleteItem();
            }
        },
        {
            title: "Undo",
            icon: <IconArrowBackUp size={18} />,
            variant: "secondary",
            wide: true,
            disabled: !canUndo,
            onClick: () => {
                onUndo();
            }
        },
        {
            title: "Redo",
            icon: <IconArrowForwardUp size={18} />,
            variant: "secondary",
            wide: true,
            disabled: !canRedo,
            onClick: () => {
                onRedo();
            }
        },
        {
            title: isAllExpanded ? "Collapse all" : "Expand all",
            icon: isAllExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />,
            variant: "secondary",
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
                            // m-0: temp fix until Semantic UI is removed (it adds an unneeded margin).
                            // !w-20: editing actions are twice the default 40px icon-button width.
                            className={action.wide ? "m-0 !w-20" : "m-0"}
                        />
                    </Tooltip>
                ))
            }
        </Stack>
    )
}

export default BookActions;