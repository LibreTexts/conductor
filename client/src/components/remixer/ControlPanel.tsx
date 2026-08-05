import { Button, IconButton, Menu, Select, Tooltip, type ButtonProps, type IconButtonProps } from "@libretexts/davis-react";
import { CopyMode } from "./model";
import { IconClockEdit, IconDeviceFloppy, IconPencilPause, IconRefresh, IconSettings } from "@tabler/icons-react";
import ConsultInsightButton from "../NextGenComponents/ConsultInsightButton";

interface ControlPanelNewUITempProps {
    isNarrowScreen: boolean;
    isAdmin: boolean;
    copyModeState: string;
    onCopyModeChange: (mode: string) => void;
    onStartOver: () => void;
    onLoadVersion: () => void;
    onAutoNumberingSettings: () => void;
    onSaveDraft: () => void;
    onSaveChanges: () => void;
}

interface CopyModeState {
    title: string;
    value: CopyMode;
    isAdminOnly: boolean;
}

const COPY_MODE_STATES: CopyModeState[] = [
    { title: "Copy-Transclude", value: "Transclude", isAdminOnly: false },
    { title: "Copy-Fork", value: "Fork", isAdminOnly: true },
    { title: "Copy-Full", value: "Full", isAdminOnly: true },
];

type ControlPanelAction = {
    icon: React.ReactNode;
    group: 'left' | 'right';
    onClick: () => void;
} & ({ title: string; variant: ButtonProps['variant']; } | { tooltip: string; variant: IconButtonProps['variant']; });

const ControlPanelNewUITemp: React.FC<ControlPanelNewUITempProps> = ({
    isNarrowScreen,
    isAdmin,
    copyModeState,
    onCopyModeChange,
    onStartOver,
    onLoadVersion,
    onAutoNumberingSettings,
    onSaveDraft,
    onSaveChanges
}) => {

    const actions: ControlPanelAction[] = [
        {
            tooltip: "Start over",
            icon: <IconRefresh size={18} />,
            variant: "destructive",
            group: 'left',
            onClick: () => {
                onStartOver();
            }
        },
        {
            tooltip: "Load Saved Draft",
            icon: <IconClockEdit size={18} />,
            variant: "secondary",
            group: 'left',
            onClick: () => {
                onLoadVersion();
            }
        },
        {
            tooltip: "Auto Numbering Settings",
            icon: <IconSettings size={18} />,
            variant: "secondary",
            group: 'left',
            onClick: () => {
                onAutoNumberingSettings();
            }
        },
        {
            title: "Save as Draft",
            icon: <IconPencilPause size={18} />,
            variant: "outline",
            group: 'right',
            onClick: () => {
                onSaveDraft();
            }
        },
        {
            title: "Save Changes",
            icon: <IconDeviceFloppy size={18} />,
            variant: "primary",
            group: 'right',
            onClick: () => {
                onSaveChanges();
            }
        }
    ]

    return (
        <div className="flex items-center gap-2">
            <Select
                id="remixer-mode"
                name="remixer-mode"
                label=""
                placeholder="Mode..."
                className="w-48 mb-1"
                value={copyModeState}
                onChange={(e) => {
                    onCopyModeChange(e.target.value);
                }}
                options={COPY_MODE_STATES.filter((mode) => isAdmin ? true : !mode.isAdminOnly).map((mode) => ({
                    value: mode.value,
                    label: mode.title,
                }))}
            />
            {
                isNarrowScreen ? (
                    <Menu>
                        <Menu.Button>Menu</Menu.Button>
                        <Menu.Items>
                            {
                                actions.map((action, index) => (
                                    <Menu.Item
                                        key={index}
                                        icon={action.icon}
                                        onClick={action.onClick}
                                    >
                                        {'title' in action ? action.title : action.tooltip}
                                    </Menu.Item>
                                ))
                            }
                        </Menu.Items>
                    </Menu>
                ) : (
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            {
                                actions.filter(action => action.group === 'left').map((action, index) => {
                                    if ('tooltip' in action) {
                                        return (
                                            <Tooltip key={index} content={action.tooltip}>
                                                <IconButton
                                                    aria-label={action.tooltip}
                                                    variant={action.variant}
                                                    key={index}
                                                    icon={action.icon}
                                                    onClick={action.onClick}
                                                    title={action.tooltip}
                                                    className="m-0!" // This is a temp fix until Semantic UI is removed from the project. It's applying a margin to the button that isn't needed
                                                />
                                            </Tooltip>
                                        )
                                    }
                                    return (
                                        <Button
                                            key={index}
                                            variant={action.variant}
                                            icon={action.icon}
                                            onClick={action.onClick}
                                        >
                                            {action.title}
                                        </Button>
                                    )
                                })
                            }
                            <Tooltip content="Consult the Insight Knowledge Base for more information about the Remixer">
                                <ConsultInsightButton href="https://commons.libretexts.org/insight/the-remixer" />
                            </Tooltip>
                        </div>
                        <div className="flex items-center gap-2">
                            {
                                actions.filter(action => action.group === 'right').map((action, index) => {
                                    if ('tooltip' in action) {
                                        return (
                                            <Tooltip key={index} content={action.tooltip}>
                                                <Button
                                                    key={index}
                                                    variant={action.variant}
                                                    icon={action.icon}
                                                    onClick={action.onClick}
                                                    title={action.tooltip}
                                                />
                                            </Tooltip>
                                        )
                                    }

                                    return (
                                        <Button
                                            key={index}
                                            variant={action.variant}
                                            icon={action.icon}
                                            onClick={action.onClick}
                                        >
                                            {action.title}
                                        </Button>
                                    )
                                })
                            }
                        </div>

                    </div>
                )
            }
        </div >
    )
}

export default ControlPanelNewUITemp;