export type Sender = {
  uuid: string;
  firstName: string;
  lastName: string;
};

export type ProjectSummary = {
  projectID: string;
  title: string;
};
  
export type BaseInvitation = {
    projectID: string;
    senderID: string;
    email: string;
    role: string;
    accepted: boolean;
    expires: string;
    inviteID: string;
    createdAt: string;
    updatedAt: string;
};

export type Invitation = BaseInvitation & {
    sender: Sender;
};

export type GetInvitationResponse = BaseInvitation & {
    project: ProjectSummary;
    sender: Sender;
};

export type InvitationsResponse = {
    invitations: Invitation[];
    total: number;
    pagination: {
      page: number;
      limit: number;
    };
};