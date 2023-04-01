export type Homework = {
  hwID: string;
  title: string;
  kind: string;
  externalID: string;
  description: string;
  adaptAssignments: AdaptAssignment[];
  adaptOpen: boolean;
};

export type AdaptAssignment = {
  title: string;
  description: string;
};
