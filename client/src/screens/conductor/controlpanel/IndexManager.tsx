import { useState } from "react";
import { Grid, Header, Segment, Button, Table, Message, Icon, Label } from "semantic-ui-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDocumentTitle } from "usehooks-ts";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";
import "../../../components/controlpanel/ControlPanel.css";

interface IndexStatus {
    name: string;
    numberOfDocuments?: number;
    isIndexing?: boolean;
    fieldDistribution?: Record<string, number>;
    filterableAttributes?: string[];
    sortableAttributes?: string[];
    error?: string;
}

/**
 * The Index Manager interface allows superadmins to manage Meilisearch indexes
 * including checking status, re-syncing data, and re-initializing settings.
 */
const IndexManager = () => {
    useDocumentTitle("LibreTexts Conductor | Index Manager");
    const { addNotification } = useNotifications();
    const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

    const {
        data: statusData,
        isLoading: statusLoading,
        error: statusError,
        refetch: refetchStatus,
    } = useQuery({
        queryKey: ["searchIndexStatus"],
        queryFn: async () => {
            const response = await api.getSearchIndexStatus();
            return response;
        },
    });

    const resyncMutation = useMutation({
        mutationFn: async (indexName: string) => {
            return await api.resyncSearchIndex(indexName);
        },
        onSuccess: (data) => {
            addNotification({
                type: "success",
                message: data.msg || "Index re-sync initiated successfully",
            });
            refetchStatus();
        },
        onError: (error: any) => {
            addNotification({
                type: "error",
                message: error.response?.data?.errMsg || "Failed to initiate index re-sync",
            });
        },
    });

    const reinitializeMutation = useMutation({
        mutationFn: async (indexName: string) => {
            return await api.reinitializeSearchIndexSettings(indexName);
        },
        onSuccess: (data) => {
            addNotification({
                type: "success",
                message: data.message || "Index settings re-initialized successfully",
            });
            refetchStatus();
        },
        onError: (error: any) => {
            addNotification({
                type: "error",
                message:
                    error.response?.data?.errMsg || "Failed to re-initialize index settings",
            });
        },
    });

    const toggleExpandIndex = (indexName: string) => {
        setExpandedIndex(expandedIndex === indexName ? null : indexName);
    };

    const formatNumber = (num?: number) => {
        if (num === undefined) return "N/A";
        return num.toLocaleString();
    };

    return (
        <Grid className="controlpanel-container" divided="vertically">
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className="component-header">Meilisearch Index Manager</Header>
                </Grid.Column>
            </Grid.Row>

            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <Header as="h3">Index Management</Header>
                            <p>
                                View the status of Conductor's Meilisearch indexes below. Use the action buttons
                                on each index to re-sync data or re-initialize settings.
                            </p>
                        </div>
                        <div>
                            <Button
                                color="blue"
                                onClick={() => refetchStatus()}
                                loading={statusLoading}
                                icon
                                labelPosition="left"
                            >
                                <Icon name="refresh" />
                                Refresh Status
                            </Button>
                        </div>
                    </Segment>
                </Grid.Column>
            </Grid.Row>

            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment loading={statusLoading}>
                        <Header as="h3">Index Status</Header>

                        {statusError ? (
                            <Message negative>
                                <Message.Header>Error Loading Index Status</Message.Header>
                                <p>
                                    {(statusError as any)?.response?.data?.errMsg ||
                                        "Failed to load index status"}
                                </p>
                            </Message>
                        ) : null}

                        {statusData && statusData.indexes && (
                            <Table celled>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>Index Name</Table.HeaderCell>
                                        <Table.HeaderCell>Documents</Table.HeaderCell>
                                        <Table.HeaderCell>Status</Table.HeaderCell>
                                        <Table.HeaderCell>Actions</Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>

                                <Table.Body>
                                    {statusData.indexes.map((index: IndexStatus) => (
                                        <>
                                            <Table.Row key={index.name}>
                                                <Table.Cell>
                                                    <strong>{index.name}</strong>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    {index.error
                                                        ? "N/A"
                                                        : formatNumber(index.numberOfDocuments)}
                                                </Table.Cell>
                                                <Table.Cell>
                                                    {index.error ? (
                                                        <Label color="red">Error</Label>
                                                    ) : index.isIndexing ? (
                                                        <Label color="yellow">
                                                            <Icon name="circle notch" loading />
                                                            Indexing
                                                        </Label>
                                                    ) : (
                                                        <Label color="green">Ready</Label>
                                                    )}
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <div className="flex gap-2 flex-wrap">
                                                        <Button
                                                            size="small"
                                                            color="green"
                                                            icon
                                                            labelPosition="left"
                                                            onClick={() => resyncMutation.mutate(index.name)}
                                                            loading={resyncMutation.isPending}
                                                            disabled={!!index.error}
                                                        >
                                                            <Icon name="sync" />
                                                            Re-sync
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            color="orange"
                                                            icon
                                                            labelPosition="left"
                                                            onClick={() => reinitializeMutation.mutate(index.name)}
                                                            loading={reinitializeMutation.isPending}
                                                            disabled={!!index.error}
                                                        >
                                                            <Icon name="settings" />
                                                            Re-initialize
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            icon
                                                            onClick={() => toggleExpandIndex(index.name)}
                                                        >
                                                            <Icon
                                                                name={
                                                                    expandedIndex === index.name
                                                                        ? "angle up"
                                                                        : "angle down"
                                                                }
                                                            />
                                                            {expandedIndex === index.name ? "Hide" : "Details"}
                                                        </Button>
                                                    </div>
                                                </Table.Cell>
                                            </Table.Row>

                                            {expandedIndex === index.name && (
                                                <Table.Row>
                                                    <Table.Cell colSpan={4}>
                                                        {index.error ? (
                                                            <Message negative>
                                                                <Message.Header>Error</Message.Header>
                                                                <p>{index.error}</p>
                                                            </Message>
                                                        ) : (
                                                            <div className="p-4">
                                                                <div className="mb-4">
                                                                    <Header as="h4">Field Distribution</Header>
                                                                    {index.fieldDistribution &&
                                                                        Object.keys(index.fieldDistribution).length > 0 ? (
                                                                        <Table basic compact>
                                                                            <Table.Header>
                                                                                <Table.Row>
                                                                                    <Table.HeaderCell>Field</Table.HeaderCell>
                                                                                    <Table.HeaderCell>
                                                                                        Count
                                                                                    </Table.HeaderCell>
                                                                                </Table.Row>
                                                                            </Table.Header>
                                                                            <Table.Body>
                                                                                {Object.entries(
                                                                                    index.fieldDistribution
                                                                                ).map(([field, count]) => (
                                                                                    <Table.Row key={field}>
                                                                                        <Table.Cell>{field}</Table.Cell>
                                                                                        <Table.Cell>
                                                                                            {formatNumber(count)}
                                                                                        </Table.Cell>
                                                                                    </Table.Row>
                                                                                ))}
                                                                            </Table.Body>
                                                                        </Table>
                                                                    ) : (
                                                                        <p className="text-gray-500">No fields</p>
                                                                    )}
                                                                </div>

                                                                <div className="mb-4">
                                                                    <Header as="h4">Filterable Attributes</Header>
                                                                    {index.filterableAttributes &&
                                                                        index.filterableAttributes.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {index.filterableAttributes.map((attr) => (
                                                                                <Label key={attr}>{attr}</Label>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-gray-500">
                                                                            No filterable attributes
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                <div>
                                                                    <Header as="h4">Sortable Attributes</Header>
                                                                    {index.sortableAttributes &&
                                                                        index.sortableAttributes.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {index.sortableAttributes.map((attr) => (
                                                                                <Label key={attr} color="blue">
                                                                                    {attr}
                                                                                </Label>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-gray-500">
                                                                            No sortable attributes
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Table.Cell>
                                                </Table.Row>
                                            )}
                                        </>
                                    ))}
                                </Table.Body>
                            </Table>
                        )}

                        {!statusLoading &&
                            statusData &&
                            (!statusData.indexes || statusData.indexes.length === 0) && (
                                <Message info>
                                    <Message.Header>No Indexes Found</Message.Header>
                                    <p>No Meilisearch indexes are currently configured.</p>
                                </Message>
                            )}
                    </Segment>
                </Grid.Column>
            </Grid.Row>

            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment>
                        <Header as="h3">About These Operations</Header>
                        <div className="space-y-6">
                            <div>
                                <Header as="h4">
                                    <Icon name="sync" size="tiny" />
                                    Re-sync Index
                                </Header>
                                <p>
                                    Fetches all data from MongoDB for the selected index and adds it to
                                    Meilisearch. This operation runs in the background and may take several
                                    minutes depending on the amount of data. Existing documents will be
                                    updated with the latest data.
                                </p>
                            </div>

                            <div>
                                <Header as="h4">
                                    <Icon name="settings" size="tiny" />
                                    Re-initialize Settings
                                </Header>
                                <p>
                                    Re-applies the filterable and sortable attribute configurations to the
                                    selected index. Use this if index settings have been modified or
                                    corrupted. This operation does not affect document data.
                                </p>
                            </div>

                            <div>
                                <Header as="h4">
                                    <Icon name="info circle" size="tiny" />
                                    Index Information
                                </Header>
                                <p>
                                    The status display shows the current state of each index including
                                    document counts, field distributions, and configured attributes. Click
                                    the "Details" button on any index to see more detailed information.
                                </p>
                            </div>
                        </div>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );
};

export default IndexManager;
