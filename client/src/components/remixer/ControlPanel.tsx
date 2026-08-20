import { Button, IconButton, Menu, Select, Tooltip, type ButtonProps, type IconButtonProps } from "@libretexts/davis-react";
import { useEffect, useState } from "react";
import { CopyMode } from "./model";
import { IconAtom, IconClockEdit, IconDeviceFloppy, IconDownload, IconPencilPause, IconRefresh, IconSettings } from "@tabler/icons-react";
import ConsultInsightButton from "../NextGenComponents/ConsultInsightButton";
import {
    dumpProjectToLocalStorageToJsonFile,
    getLocalDraft,
    LOCAL_DRAFT_CHANGE_EVENT,
} from "./services";

interface ControlPanelNewUITempProps {
    isNarrowScreen: boolean;
    isAdmin: boolean;
    copyModeState: string;
    projectID: string;
    projectName: string | undefined;
    onCopyModeChange: (mode: string) => void;
    onCreateMatter: () => void;
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
    disabled?: boolean;
} & ({ title: string; variant: ButtonProps['variant']; } | { tooltip: string; variant: IconButtonProps['variant']; });

const ControlPanelNewUITemp: React.FC<ControlPanelNewUITempProps> = ({
    isNarrowScreen,
    isAdmin,
    copyModeState,
    projectID,
    projectName,
    onCopyModeChange,
    onCreateMatter,
    onStartOver,
    onLoadVersion,
    onAutoNumberingSettings,
    onSaveDraft,
    onSaveChanges
}) => {
    const [hasLocalDraft, setHasLocalDraft] = useState(
        () => getLocalDraft(projectID) != null,
    );

    useEffect(() => {
        const refresh = () => {
            setHasLocalDraft(getLocalDraft(projectID) != null);
        };

        refresh();

        const onLocalDraftChange = (event: Event) => {
            const detail = (event as CustomEvent<{ projectId?: string }>).detail;
            if (detail?.projectId && detail.projectId !== projectID) return;
            refresh();
        };

        const onStorage = (event: StorageEvent) => {
            if (
                event.key != null &&
                event.key !== `remixer_draft_${projectID}`
            ) {
                return;
            }
            refresh();
        };

        window.addEventListener(LOCAL_DRAFT_CHANGE_EVENT, onLocalDraftChange);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener(
                LOCAL_DRAFT_CHANGE_EVENT,
                onLocalDraftChange,
            );
            window.removeEventListener("storage", onStorage);
        };
    }, [projectID]);

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
            tooltip: "Local storage download",
            icon: <IconDownload size={18} />,
            variant: "secondary",
            group: 'left',
            disabled: !hasLocalDraft,
            onClick: () => {
                dumpProjectToLocalStorageToJsonFile({ projectID, projectName });
            }
        },
        ...(isAdmin ? [{
            tooltip: "Create Front or Back Matter (Admin Only)",
            icon: <IconAtom size={18} />,
            variant: "secondary",
            group: 'left',
            onClick: () => {
                onCreateMatter();
            }
        } as ControlPanelAction] : []),
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
                                        disabled={action.disabled}
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
                                                    disabled={action.disabled}
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
                                            disabled={action.disabled}
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
                                                    disabled={action.disabled}
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
                                            disabled={action.disabled}
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