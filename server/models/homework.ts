import { model, Model, Schema, Document } from "mongoose";

export interface HomeworkInterface extends Document {
  hwID: string;
  title: string;
  kind: string;
  externalID: string;
  description: string;
  adaptAssignments: {
    title: string;
    description: string;
  }[];
  adaptOpen?: boolean;
}

const HomeworkSchema: Schema<HomeworkInterface> = new Schema(
  {
    hwID: {
      // base62 11-digit identifier
      type: String,
      required: true,
      unique: true,
    },
    title: {
      // the full book title
      type: String,
      required: true,
    },
    kind: {
      type: String, // the assignment type (i.e., 'adapt', 'h5p')
      required: true,
    },
    externalID: {
      // the identifier used in the origin system
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    adaptAssignments: [
      {
        // the array of assignments for an ADAPT course
        title: String,
        description: String,
      },
    ],
    adaptOpen: Boolean, // is an ADAPT open course
  },
  {
    timestamps: true,
  }
);

const Homework: Model<HomeworkInterface> = model("Homework", HomeworkSchema);

export default Homework;
