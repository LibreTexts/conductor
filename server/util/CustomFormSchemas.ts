/**
 * MongoDB Schema object for CustomFormHeadingType
 */
const CustomFormHeadingSchema = {
  // form sub-headings or "sections"
  text: {
    type: String,
    required: true,
  },
  order: {
    // the position of the heading within the form (ascending, starting at 1)
    type: Number,
    required: true,
    min: 1,
  },
};

/**
 * MongoDB Schema object for CustomFormTextBlockType
 */
const CustomFormTextBlockSchema = {
  // text blocks for instructions/more details (simple Markdown)
  text: {
    type: String,
    required: true,
  },
  order: {
    // the position of the heading within the form (ascending, starting at 1)
    type: Number,
    required: true,
    min: 1,
  },
};

/**
 * MongoDB Schema object for CustomFormPromptType
 */
const CustomFormPromptSchema = {
  // forms prompts/question
  promptType: {
    // the prompt type, one of: ['3-likert', '5-likert', '7-likert', 'text', 'dropdown', 'checkbox']
    type: String,
    required: true,
  },
  promptText: {
    // the prompt instructions/text, in simple Markdown
    type: String,
    required: true,
  },
  promptRequired: {
    // whether answering the prompt is required to submit the review
    type: Boolean,
    default: false,
  },
  promptOptions: [
    {
      // dropdown option entries (up to 10), if the prompt is of promptType 'dropdown'
      key: String,
      value: String,
      text: String,
    },
  ],
  order: {
    // the position of the prompt within the form (ascending, starting at 1)
    type: Number,
    required: true,
    min: 1,
  },
};

export {
  CustomFormHeadingSchema,
  CustomFormPromptSchema,
  CustomFormTextBlockSchema,
};
