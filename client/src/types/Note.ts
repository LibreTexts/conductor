export type EditNoteModalProps = {
    open: boolean;
    onClose: (refresh?: boolean) => void;
    note: Note | null;
    userId: string;
};
  
export type NoteFormData = {
    content: string;
};

export type InternalNotesSectionProps = {
    userId: string;
    canEdit?: boolean;
};
  
export type BasicUserInfo = {
    uuid: string;
    first_name: string;
    last_name: string;
    email: string;
};
  
export type Note = {
    uuid: string;
    content: string;
    updated_at: string;
    created_at: string;
    created_by_id: string;
    created_by_user: BasicUserInfo;
    updated_by_id: string;
    updated_by_user: BasicUserInfo;
    user_id: string;
};