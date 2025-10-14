export type SupportQueue = {
    id: string;
    name: string;
    description: string;
    ticket_descriptor: string;
    slug: string;
    active: boolean;
    color: string;
    icon: string;
    order: number;
    is_default: boolean;
    form_fields: Array<{
        id: string;
        field_type: string;
        label: string;
        required: boolean;
        order: number;
        placeholder?: string;
        options?: string[];
    }>;
    ticket_count?: number;
}

export type SupportQueueMetrics = {
    total_open_tickets: number;
    avg_mins_to_close: number;
    tickets_opened_last_7_days: number;
}