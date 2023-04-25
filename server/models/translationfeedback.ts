import { model, Model, Schema, Document } from "mongoose";

export interface TranslationFeedbackInterface extends Document {
  language: string;
  accurate: boolean;
  page: string;
  feedback?: {
    incorrect?: string;
    corrected?: string;
  }[];
}

const TranslationFeedbackSchema: Schema<TranslationFeedbackInterface> =
  new Schema(
    {
      language: {
        // the target translation lanuage
        type: String,
        required: true,
      },
      accurate: {
        // true if machine translation was accurate, false otherwise
        type: Boolean,
        required: true,
      },
      page: {
        // the URL of the translated page
        type: String,
        required: true,
      },
      feedback: [
        {
          // array of incorrect terms and their correct translation
          incorrect: String,
          corrected: String,
        },
      ],
    },
    {
      timestamps: true,
    }
  );

const TranslationFeedback: Model<TranslationFeedbackInterface> = model(
  "TranslationFeedback",
  TranslationFeedbackSchema
);

export default TranslationFeedback;
