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

/**
 * The artifacts a Shapeshift compile produces. Mirrors the server registry in
 * `server/api/services/book-export-service.ts`.
 */
export type BookExportKey =
  | 'full-pdf'
  | 'content-pdf'
  | 'cover-casewrap'
  | 'cover-perfectbound'
  | 'thincc'
  | 'page-pdfs'
  | 'epub';

export type BookExportGroup = 'full-book' | 'publication' | 'other';

/**
 * One export as the downloads service currently holds it.
 *
 * `available` is answered by a server-side probe, not assumed from job status:
 * a compile can report success while silently failing to write one artifact.
 */
export type BookExport = {
  key: BookExportKey;
  available: boolean;
  sizeBytes?: number;
  generatedAt?: string;
  downloadURL: string;
};

export type BookExportInfo = {
  isCompiled?: boolean;
  lastCompiled?: number;
  compiledBy?: string;
  contentPageCount?: number;
  lastJobID?: string;
  lastJobSubmittedAt?: string;
  lastJobSubmittedBy?: string;
};

export type BookExportManifest = {
  exports: BookExport[];
  exportInfo: BookExportInfo | null;
};

export type BookCompileJob = {
  job: ShapeshiftJob | null;
  exportInfo: BookExportInfo | null;
};
