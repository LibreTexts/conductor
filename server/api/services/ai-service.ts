import axios, { AxiosInstance } from "axios";

export default class AIService {
  private apiKey: string = process.env.OPENAI_API_KEY || "";
  private baseCompletionsURL: string =
    "https://api.openai.com/v1/chat/completions";
  private axiosInstance: AxiosInstance = axios.create({
    baseURL: this.baseCompletionsURL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    },
  });

  public async generatePageOverview(
    pageText: string,
    delay?: number
  ): Promise<string | "empty" | "internal"> {
    try {
      if (!pageText || pageText.length < 50) {
        return "empty";
      }

      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const response = await this.axiosInstance.post("", {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Generate a summary of this page. Disregard any code blocks or images. The summary may not exceed 500 characters. If there is no summary, please return the word 'empty'.",
          },
          {
            role: "user",
            content: pageText,
          },
        ],
      });

      const rawOutput = response.data?.choices?.[0]?.message?.content;
      let aiSummaryOutput = rawOutput
        ? rawOutput === "empty"
          ? ""
          : rawOutput
        : "";
      if (!aiSummaryOutput) {
        return "empty";
      }

      // If summary returned was longer than 500 chars, find last period before limit and truncate
      if (aiSummaryOutput.length > 500) {
        const lastPeriodIndex = aiSummaryOutput.lastIndexOf(".", 500);
        aiSummaryOutput = aiSummaryOutput.slice(0, lastPeriodIndex + 1);
      }

      return aiSummaryOutput;
    } catch (error) {
      console.error(error);
      return "internal";
    }
  }

  public async generatePageTags(
    pageText: string,
    delay?: number
  ): Promise<string[] | "empty" | "error"> {
    try {
      if (!pageText || pageText.length < 50) {
        return "empty";
      }

      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const response = await this.axiosInstance.post("", {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Generate a list of tags, separated by commas, for this page. Disregard any code blocks or images. If you are unable to create any tags, please return the word 'empty'.",
          },
          {
            role: "user",
            content: pageText,
          },
        ],
      });

      const rawOutput = response.data?.choices?.[0]?.message?.content;
      const aiTagsOutput = rawOutput
        ? rawOutput === "empty"
          ? ""
          : rawOutput
        : "";
      if (!aiTagsOutput) {
        return "empty";
      }

      const splitTags =
        aiTagsOutput.split(",").map((tag: string) => tag.trim()) || [];

      // if tags end with a period, remove it
      if (
        splitTags.length > 0 &&
        splitTags[splitTags.length - 1].endsWith(".")
      ) {
        splitTags[splitTags.length - 1] = splitTags[splitTags.length - 1].slice(
          0,
          -1
        );
      }

      return splitTags;
    } catch (error) {
      console.error(error);
      return "error";
    }
  }

  public async generateImageAltText(
    fileType: string,
    imageBase64: string,
    delay?: number
  ): Promise<string | "empty" | "error" | "unsupported"> {
    try {
      const supportedFileMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];

      if (!supportedFileMimeTypes.includes(fileType)) {
        return "unsupported";
      }

      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const response = await this.axiosInstance.post("", {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Create an alt text description for this image. The description should be concise and descriptive, no longer than 125 characters. If you are unable to create an alt text description, please return only the word 'empty'. If you are able to create an alt text description, simply return that description without any additional text.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Here is the url of the image: ",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/${fileType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      });

      const rawOutput = response.data?.choices?.[0]?.message?.content;
      if (!rawOutput) {
        return "error";
      }

      const altText = rawOutput ? (rawOutput === "empty" ? "" : rawOutput) : "";
      return altText;
    } catch (error) {
      console.error(error);
      return "error";
    }
  }
}
