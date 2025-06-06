import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { encodeGenerator, decode, decodeGenerator } from "gpt-tokenizer";
import { APIPromise } from "openai/core";
import axios from "axios";
import {
  AltTextAICreateImage200Response,
  AltTextAICreateImage4XXResponse,
} from "../../types";
import { convertBase64SVGToBase64PNG } from "../../util/imageutils";

export default class AIService {
  private OpenAIClient: OpenAI = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
  });

  private AltTextAIClient = axios.create({
    baseURL: "https://alttext.ai/api/v1",
    headers: {
      "x-api-key": process.env.ALTTEXT_API_KEY || "",
    },
  });

  private _pageOverviewMessages = (
    pageText: string
  ): ChatCompletionMessageParam[] => [
    {
      role: "system",
      content:
        "Generate a summary of this text. Disregard any code blocks, equations, or images. The summary may not exceed 500 characters. If you are unable to generate a summary, return only the word 'empty'.",
    },
    {
      role: "user",
      content: pageText,
    },
  ];

  private _summarizeSummaryMessages = (
    summaries: string[]
  ): ChatCompletionMessageParam[] => [
    {
      role: "system",
      content:
        "Given the following list of summaries, seperated by semicolons, generate a concise summary of these summaries. The final summary may not exceed 500 characters. If you are unable to generate a final summary, return only the word 'empty'. When referring to the content that is being summarized, refer to it as 'this page'.",
    },
    {
      role: "user",
      content: summaries.join(";"),
    },
  ];

  private _pageTagsMessages = (
    pageText: string
  ): ChatCompletionMessageParam[] => [
    {
      role: "system",
      content:
        "Generate a list of tags, separated by commas, for this text. Disregard any code blocks, equations, or images. The tags should be only alphanumeric. If you are unable to create any tags, return only the word 'empty'.",
    },
    {
      role: "user",
      content: pageText,
    },
  ];

  private _tagsSummaryMessages = (
    tags: string[]
  ): ChatCompletionMessageParam[] => [
    {
      role: "system",
      content:
        "Given the following list of tags, select the most 10 most useful tags for content tagging and organization purposes and return them as a new list, each separated by a comma. If you are unable to generate a new list of tags, return only the word 'empty'. The final list of tags should not have more than 10 tags. If there are more than 10 tags, only return the first 10 tags.",
    },
    {
      role: "user",
      content: tags.join(", "),
    },
  ];

  private _imageAltTextMessages = (
    fileType: string,
    imageBase64: string
  ): ChatCompletionMessageParam[] => [
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
            detail: "low",
          },
        },
      ],
    },
  ];

  /**
   * Split text into chunks based on the desired number of tokens per chunk
   * @param text - text to split into chunks
   * @param tokensPerChunk - desired number of tokens per chunk
   * @returns - array of text chunks
   */
  public async chunkText(
    text: string,
    tokensPerChunk: number
  ): Promise<string[]> {
    if (!text) {
      return [];
    }

    const tokens: number[] = [];
    for (const tokenChunk of encodeGenerator(text)) {
      tokens.push(...tokenChunk);
    }

    const chunks: string[] = [];
    for (let i = 0; i < tokens.length; i += tokensPerChunk) {
      const chunk = tokens.slice(i, i + tokensPerChunk); // Take maxTokens at a time
      let decodedChunk = "";
      for (const part of decodeGenerator(chunk)) {
        decodedChunk += part;
      }
      chunks.push(decodedChunk);
    }

    return chunks;
  }

  public async generatePageOverview(
    chunks: string[], // array of text chunks
    delay?: number
  ): Promise<string | "empty" | "internal"> {
    try {
      if (!chunks || chunks.length === 0) {
        return "empty";
      }

      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const promises: APIPromise<OpenAI.Chat.Completions.ChatCompletion>[] = [];
      chunks.forEach((chunk) => {
        promises.push(
          this.OpenAIClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: this._pageOverviewMessages(chunk),
            max_completion_tokens: 400,
          })
        );
      });

      const allResponses = await Promise.allSettled(promises);
      const parsedResponses = [];

      for (const response of allResponses) {
        if (response.status === "rejected") {
          return "internal";
        }

        const rawOutput = response.value.choices[0].message.content;

        const chunkSummary = rawOutput
          ? rawOutput === "empty"
            ? ""
            : rawOutput
          : "";
        if (!chunkSummary) {
          parsedResponses.push("empty");
        } else {
          parsedResponses.push(chunkSummary);
        }
      }

      const finalResponse = await this.OpenAIClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: this._summarizeSummaryMessages(
          parsedResponses.filter((r) => r !== "empty")
        ),
        max_completion_tokens: 400,
      });

      const rawOutput = finalResponse.choices[0].message.content;
      let aiSummaryOutput = rawOutput
        ? rawOutput === "empty"
          ? ""
          : rawOutput
        : "";

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
    chunks: string[], // array of text chunks
    delay?: number
  ): Promise<string[] | "empty" | "error"> {
    try {
      if (!chunks || chunks.length === 0) {
        return "empty";
      }

      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const promises: APIPromise<OpenAI.Chat.Completions.ChatCompletion>[] = [];
      chunks.forEach((chunk) => {
        promises.push(
          this.OpenAIClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: this._pageTagsMessages(chunk),
            max_completion_tokens: 400,
          })
        );
      });

      const allResponses = await Promise.allSettled(promises);
      const parsedResponses = [];

      for (const response of allResponses) {
        if (response.status === "rejected") {
          return "error";
        }

        const rawOutput = response.value.choices[0].message.content;

        const chunkTags = rawOutput
          ? rawOutput === "empty"
            ? ""
            : rawOutput
          : "";
        if (!chunkTags) {
          parsedResponses.push("empty");
        } else {
          parsedResponses.push(chunkTags);
        }
      }

      const finalResponse = await this.OpenAIClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: this._tagsSummaryMessages(
          parsedResponses.filter((r) => r !== "empty")
        ),
        max_completion_tokens: 400,
      });

      const rawOutput = finalResponse.choices[0].message.content;
      const aiTagsOutput = rawOutput
        ? rawOutput === "empty"
          ? ""
          : rawOutput
        : "";

      const splitTags =
        aiTagsOutput.split(",").map((tag: string) => tag.trim()) || [];

      // Remove any extra whitespace from tags
      splitTags.forEach((t) => t.trim());

      // if tags end with a period, remove the period
      if (
        splitTags.length > 0 &&
        splitTags[splitTags.length - 1].endsWith(".")
      ) {
        splitTags[splitTags.length - 1] = splitTags[splitTags.length - 1].slice(
          0,
          -1
        );
      }

      // Filter out any falsey values (empty strings, null, undefined, etc.)
      const filtered = splitTags.filter((t) => !!t);
      const unique = [...new Set(filtered)];

      return unique.length > 10 ? unique.slice(0, 10) : unique;
    } catch (error) {
      console.error(error);
      return "error";
    }
  }

  public supportedFileMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/svg+xml",
  ];

  public supportedFileExtensions = [
    "jpeg",
    "jpg",
    "png",
    "gif",
    "webp",
    "bmp",
    "svg",
  ];

  public async generateImageAltText(
    fileType: string,
    imageBase64: string,
    delay?: number
  ): Promise<string | "error" | "unsupported"> {
    try {
      if (!this.supportedFileMimeTypes.includes(fileType)) {
        return "unsupported";
      }

      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // If image is SVG, convert to PNG
      if (fileType === "image/svg+xml") {
        imageBase64 = await convertBase64SVGToBase64PNG(imageBase64);
      }

      const response =
        await this.AltTextAIClient.post<AltTextAICreateImage200Response>(
          "/images",
          {
            image: {
              raw: imageBase64,
            },
          }
        );

      const output = response.data.alt_text;
      if (!output) {
        return "error";
      }

      return output;
    } catch (error) {
      console.error(error);
      return "error";
    }
  }
}
