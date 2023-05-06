import { model, Schema, Document } from "mongoose";

export interface AdoptionReportInterface extends Document {
  email: string;
  name: string;
  role: string;
  resource?: {
    id: string;
    title: string;
    library: string;
    link: string;
  };
  instructor?: {
    isLibreNet?: string;
    institution?: string;
    class?: string;
    term?: string;
    students?: number;
    replaceCost?: number;
    printCost?: number;
    access?: string[];
  };
  student?: {
    use?: string;
    institution?: string;
    class?: string;
    instructor?: string;
    quality?: number;
    navigation?: number;
    printCost?: number;
    access?: string[];
  };
  comments?: string;
}

const AdoptionReportSchema = new Schema<AdoptionReportInterface>(
  {
    email: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    resource: {
      id: String,
      title: String,
      library: String,
      link: String,
    },
    instructor: {
      isLibreNet: String,
      institution: String,
      class: String,
      term: String,
      students: Number,
      replaceCost: Number,
      printCost: Number,
      access: {
        type: [String],
        default: undefined,
      },
    },
    student: {
      use: String,
      institution: String,
      class: String,
      instructor: String,
      quality: Number,
      navigation: Number,
      printCost: Number,
      access: {
        type: [String],
        default: undefined,
      },
    },
    comments: String,
  },
  {
    timestamps: true,
  }
);

const AdoptionReport = model<AdoptionReportInterface>(
  "AdoptionReport",
  AdoptionReportSchema
);
export default AdoptionReport;
