export type ShapeshiftJobStatus = 'created' | 'failed' | 'finished' | 'inprogress';

export type ShapeshiftJob = {
  bookID?: string;
  createdAt: string;
  id: string;
  isHighPriority: boolean;
  status: ShapeshiftJobStatus;
  url: string;
};