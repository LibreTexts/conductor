export type ShapeshiftJobStatus = 'created' | 'failed' | 'finished' | 'inprogress';

export type ShapeshiftJob = {
  id: string;
  status: ShapeshiftJobStatus;
  isHighPriority: boolean;
  url: string;
  createdAt: string;
};