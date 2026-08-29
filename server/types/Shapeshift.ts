export type ShapeshiftJobStatus = 'created' | 'failed' | 'finished' | 'inprogress';

export type ShapeshiftJob = {
  bookID?: string;
  createdAt: string;
  id: string;
  isHighPriority: boolean;
  /**
   * Completion percentage, 0-100. Absent on older jobs and on a job Shapeshift
   * has accepted but not started reporting on, so callers must handle its
   * absence rather than defaulting it to zero.
   */
  progress?: number;
  /**
   * Human-readable description of what the job is doing right now, e.g.
   * "Generating PDF".
   */
  stage?: string;
  status: ShapeshiftJobStatus;
  url: string;
};