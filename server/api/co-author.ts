import logger from "../logger.js";
import { Request, Response } from "express";
import { z } from "zod";
import { _generatePageImagesAltTextResObj, PageFile, PageFileProperty, PageImagesRes, TableOfContents, ZodReqWithUser } from "../types";
import { batchGenerateAIMetadataSchema, batchUpdateBookMetadataSchema, bulkUpdatePageTagsSchema, GeneratePageImagesAltTextSchema, getWithPageIDParamAndCoverPageIDSchema, updatePageDetailsSchema } from "./validators/book";
import { getLibraryAndPageFromBookID } from "../util/bookutils";
import authAPI from "./auth";
import mailAPI from "./mail";
import conductorErrors from "../conductor-errors";
import BookService from "./services/book-service";
import Project, { ProjectBookBatchUpdateJob, ProjectInterface } from "../models/project";
import User from "../models/user";
import { randomUUID } from "node:crypto";
import { createEventBuffer, createSession, EventBuffer, Session } from "better-sse";
import { IncomingMessage } from "node:http";
import { CXOneFetch } from "../util/librariesclient";
import MindTouch from "../util/CXOne/index.js";
import AIService from "./services/ai-service";
import * as cheerio from 'cheerio';
import { conductor400Err, conductor404Err, conductor500Err } from "../util/errorutils";

async function getPageAISummary(
    req: ZodReqWithUser<z.infer<typeof getWithPageIDParamAndCoverPageIDSchema>>,
    res: Response
) {
    try {
        const { pageID: fullPageID } = req.params;
        const { coverPageID } = req.query;

        const bookService = new BookService({ bookID: coverPageID });
        const [_, pageID] = getLibraryAndPageFromBookID(fullPageID);

        // Check if the user has access to the page and it actually exists in book's TOC.
        const canAccess = await bookService.canAccessPage(req.user.decoded.uuid, pageID);
        if (!canAccess) {
            return res.status(403).send({
                err: true,
                errMsg: conductorErrors.err8,
            });
        }

        const [error, summary] = await _generatePageAISummary(
            bookService,
            pageID,
            true
        );

        if (error) {
            return _handleAIErrorResponse(res, error);
        }

        return res.send({
            err: false,
            summary,
        });
    } catch (e) {
        logger.error({ err: e }, "getPageAISummary failed");
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

async function getPageAITags(
    req: ZodReqWithUser<z.infer<typeof getWithPageIDParamAndCoverPageIDSchema>>,
    res: Response
) {
    try {
        const { pageID: fullPageID } = req.params;
        const { coverPageID } = req.query;

        const bookService = new BookService({ bookID: coverPageID });
        const [_, pageID] = getLibraryAndPageFromBookID(fullPageID);

        // Check if the user has access to the page and it actually exists in book's TOC.
        const canAccess = await bookService.canAccessPage(req.user.decoded.uuid, pageID);
        if (!canAccess) {
            return res.status(403).send({
                err: true,
                errMsg: conductorErrors.err8,
            });
        }

        const [error, tags] = await _generatePageAITags(bookService, pageID, true);
        if (error) {
            return _handleAIErrorResponse(res, error);
        }

        return res.send({
            err: false,
            tags,
        });
    } catch (e) {
        logger.error({ err: e }, "getPageAITags failed");
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

async function generatePageImagesAltText(
    req: ZodReqWithUser<z.infer<typeof GeneratePageImagesAltTextSchema>>,
    res: Response
) {
    try {
        const { pageID: fullPageID } = req.params;
        const { coverPageID } = req.query;
        const { overwrite } = req.body;

        const bookService = new BookService({ bookID: coverPageID });
        const [_, pageID] = getLibraryAndPageFromBookID(fullPageID);

        // Check if the user has access to the page and it actually exists in book's TOC.
        const canAccess = await bookService.canAccessPage(req.user.decoded.uuid, pageID);
        if (!canAccess) {
            return res.status(403).send({
                err: true,
                errMsg: conductorErrors.err8,
            });
        }

        const [error, success, modified_count] =
            await _generateAndApplyPageImagesAltText(bookService, pageID, overwrite);

        if (error) {
            return _handleAIErrorResponse(res, error);
        }

        return res.send({
            err: false,
            success,
            modified_count,
        });
    } catch (e) {
        logger.error({ err: e }, "generatePageImagesAltText failed");
        return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
        });
    }
}

function _handleAIErrorResponse(res: Response, error: string) {
    switch (error) {
        case "location":
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err2,
            });
        case "env":
            return res.status(500).send({
                err: true,
                errMsg: conductorErrors.err6,
            });
        case "empty":
            return res.send({
                err: true,
                errMsg:
                    "No summary available for this page. There may be insufficient content.",
            });
        case "badres":
            return res.status(400).send({
                err: true,
                errMsg: "Error generating page summary.",
            });
        case "internal":
        default:
            return res.status(500).send({
                err: true,
                errMsg: conductorErrors.err6,
            });
    }
}

async function batchGenerateAIMetadata(
    req: ZodReqWithUser<z.infer<typeof batchGenerateAIMetadataSchema>>,
    res: Response
) {
    let session: Session | undefined = undefined;
    try {
        const [coverPageLibrary, coverPageID] = getLibraryAndPageFromBookID(
            req.params.bookID
        );

        const project = await Project.findOne({
            libreCoverID: coverPageID,
            libreLibrary: coverPageLibrary,
        });
        if (!project) return conductor404Err(res);

        const user = await User.findOne({ uuid: { $eq: req.user.decoded.uuid } }).orFail();
        if (!user || !user.email) return conductor400Err(res);

        // Check if the user has access to the page and it actually exists in book's TOC.
        const bookService = new BookService({ bookID: `${coverPageLibrary}-${coverPageID}` });
        const canAccess = await bookService.canAccessPage(req.user.decoded.uuid, coverPageID);
        if (!canAccess) {
            return res.status(403).send({
                err: true,
                errMsg: conductorErrors.err8,
            });
        }

        const hasActiveJob = hasActiveBatchJob(project);
        if (hasActiveJob) {
            return res.status(400).send({
                err: true,
                errMsg: "A batch AI summaries job is already running for this project.",
            });
        }

        const generateResources: ProjectBookBatchUpdateJob["generateResources"] = {
            summaries: req.body.summaries,
            tags: req.body.tags,
            alttext: req.body.alttext,
        };
        const jobType: ProjectBookBatchUpdateJob["type"] = [];
        if (generateResources.summaries?.generate) jobType.push("summaries");
        if (generateResources.tags?.generate) jobType.push("tags");
        if (generateResources.alttext?.generate) jobType.push("alttext");

        if (!jobType.length) return conductor400Err(res);

        const job = await _createBatchUpdateJob(project.projectID, {
            type: jobType,
            dataSource: "generated",
            generateResources: generateResources,
            ranBy: req.user.decoded.uuid,
        });

        session = await createSession(req as unknown as IncomingMessage, res);
        session.on('disconnected', () => {
            logger.warn(`SSE client disconnected for batch AI metadata job ${job.jobID}. This is not necessarily an error.`);
        });

        await _runBulkUpdateJob(
            session,
            job.jobID,
            job.type,
            project.projectID,
            bookService.bookID,
            job.dataSource,
            {
                summaries: req.body.summaries,
                tags: req.body.tags,
                alttext: req.body.alttext,
            },
            [user.email]
        );

        if (!session.isConnected) {
            logger.warn(`SSE client disconnected before completion of batch AI metadata job ${job.jobID}. This is not necessarily an error.`);
            return;
        }

        session.push('END');
    } catch (e) {
        logger.error({ err: e }, "batchGenerateAIMetadata failed");
        if (!res.headersSent) {
            return conductor500Err(res);
        }
        if (session && session.isConnected) {
            try {
                session.push('ERROR');
            } catch (err) {
                logger.error({ err }, "batchGenerateAIMetadata failed");
            }
        }
    }
}

async function batchUpdateBookMetadata(
    req: ZodReqWithUser<z.infer<typeof batchUpdateBookMetadataSchema>>,
    res: Response
) {
    let session: Session | undefined = undefined;
    try {
        const newPageData = req.body.pages;
        if (!newPageData || !Array.isArray(newPageData) || newPageData.length < 1) {
            return res.status(400).send({
                err: true,
                errMsg: "No page data provided.",
            });
        }

        const [coverPageLibrary, coverPageID] = getLibraryAndPageFromBookID(
            req.params.bookID
        );

        const project = await Project.findOne({
            libreCoverID: coverPageID,
            libreLibrary: coverPageLibrary,
        });
        if (!project) {
            return res.status(404).send({
                err: true,
                errMsg: conductorErrors.err11,
            });
        }

        const user = await User.findOne({ uuid: { $eq: req.user.decoded.uuid } }).orFail();
        if (!user || !user.email) {
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err9,
            });
        }
        
        // Check if the user has access to the page and it actually exists in book's TOC.
        const bookService = new BookService({ bookID: `${coverPageLibrary}-${coverPageID}` });
        const canAccess = await bookService.canAccessPage(req.user.decoded.uuid, coverPageID);
        if (!canAccess) {
            return res.status(403).send({
                err: true,
                errMsg: conductorErrors.err8,
            });
        }

        const hasActiveJob = hasActiveBatchJob(project);
        if (hasActiveJob) {
            return res.status(400).send({
                err: true,
                errMsg: "A batch job is already running for this project. Please wait for it to finish before starting another.",
            });
        }

        const job = await _createBatchUpdateJob(project.projectID, {
            type: ["summaries", "tags"], // Default to summaries+tags for user data source
            dataSource: "user",
            ranBy: req.user.decoded.uuid,
        });

        session = await createSession(req as unknown as IncomingMessage, res);
        session.on('disconnected', () => {
            logger.warn(`SSE client disconnected for batch book metadata update job ${job.jobID}. This is not necessarily an error.`);
        });

        await _runBulkUpdateJob(
            session,
            job.jobID,
            job.type,
            project.projectID,
            bookService.bookID,
            job.dataSource,
            undefined,
            [user.email],
            newPageData
        );

        if (session && session.isConnected) {
            session.push('END');
        }
    } catch (e) {
        logger.error({ err: e }, "batchUpdateBookMetadata failed");
        if (!res.headersSent) {
            return res.status(500).send({
                err: true,
                errMsg: conductorErrors.err6,
            });
        }
        if (session && session.isConnected) {
            try {
                session.push('ERROR');
            } catch (err) {
                logger.error({ err }, "batchUpdateBookMetadata failed");
            }
        }
    }
}

/**
 * Updates a Project's Book's metadata (overview, tags, or image alt text) in bulk.
 * NOTE: We purposefully do most of the async calls one by one to avoid rate limiting.
 * Using Promise.all (even with delay) will generally exceed limits for either MindTouch or OpenAI
 * @param session - The SSE session to send updates to
 * @param jobID - The job ID to run
 * @param jobType - The type of job to run (summaries, tags, alttext, or any combination)
 * @param projectID - The project ID
 * @param bookID - The id of the connected book
 * @param dataSource - The data source (user or generated). User means the data is provided in the request, generated means we will use AI to generate it
 * @param emailsToNotify - The emails to notify when the job is complete
 * @param data - The data to update (only for user data source)
 */
async function _runBulkUpdateJob(
    session: Session,
    jobID: string,
    jobType: ProjectBookBatchUpdateJob["type"],
    projectID: string,
    bookID: string,
    dataSource: ProjectBookBatchUpdateJob["dataSource"],
    generateResources: ProjectBookBatchUpdateJob["generateResources"],
    emailsToNotify: string[],
    data?: { id: string; summary?: string; tags?: string[] }[] // Only for user data source
): Promise<void> {
    // Outer catch-block will catch errors with updating a failed job
    try {
        const logStream = new BatchJobLogStream(session);
        try {
            // Inner catch-block will catch any errors and update job status
            if (!data && dataSource === "user") {
                throw new Error("No data provided for user data source");
            }

            if (!generateResources && dataSource === "generated") {
                throw new Error(
                    "Resource generation not specified for generated data source"
                );
            }

            logStream.sendAndLog(`Batch job ${jobID} started`);

            // Create book service and get table of contents
            const bookService = new BookService({ bookID });
            const toc = await bookService.getBookTOCNew();
            const pageIDs: string[] = [];
            const content = toc.children; // skip root pages

            // recursively get all page IDs
            const getIDs = (content: TableOfContents[]) => {
                content.forEach((item) => {
                    pageIDs.push(item.id);
                    if (item.children) {
                        getIDs(item.children);
                    }
                });
            };
            getIDs(content);

            // Update job with initial details
            await _updateBatchUpdateJob(projectID, jobID, { status: "running" });

            const errors = {
                meta: {
                    location: 0,
                    empty: 0,
                    internal: 0,
                },
                images: {
                    location: 0,
                    empty: 0,
                    internal: 0,
                },
            };
            let successfulImages = 0;
            let failedImages = 0;

            // Initialize new page details array
            // page overview and tags can be updated in the same call, gather both as necessary before updating page
            let newPageDetails: {
                id: string;
                summary?: string;
                tags?: string[];
                error?: string;
            }[] = [];
            if (dataSource === "user") {
                newPageDetails = data || [];
            }

            // If data source is generated, get page text content and generate tags and/or summaries
            if (dataSource === "generated") {
                // Get pages text content
                const pageTextPromises = pageIDs.map((p) => {
                    // Generate a random delay between 0 and 1s to avoid rate limiting
                    const delay = Math.floor(Math.random() * 1000);
                    return new Promise<string>((resolve) => {
                        setTimeout(async () => {
                            resolve(await bookService.getPageTextContent(p));
                        }, delay);
                    });
                });

                const pageTexts = await Promise.allSettled(pageTextPromises);
                const pageTextsMap = new Map<string, string>();
                pageIDs.forEach((p, i) => {
                    if (pageTexts[i].status === "fulfilled") {
                        logStream.sendAndLog(`Collected page text for page ID ${p} (${pageTexts[i].value.length} characters)`);
                        pageTextsMap.set(p, pageTexts[i].value);
                    }
                });

                // Do alt-text updates
                if (generateResources?.alttext?.generate) {
                    // Purposefully doing this one-by-one because of strict rate limits
                    for (const page of pageTextsMap) {
                        const [errCode, success, modifiedCount] =
                            await _generateAndApplyPageImagesAltText(
                                bookService,
                                page[0],
                                generateResources.alttext.overwrite ?? false
                            ).catch((e) => {
                                logger.error({ err: e }, "[errCode, success, modifiedCount] failed");
                                return ["internal", false, 0];
                            });
                        if (!success) {
                            failedImages++;
                            logStream.sendAndLog(`Failed to generate alt text for page ${page[0]} with error: ${errCode}`);
                            if (errCode === "location") {
                                errors.images.location++;
                            }
                            if (errCode === "empty") {
                                errors.images.empty++;
                            }
                            if (errCode === "internal") {
                                errors.images.internal++;
                            }
                        } else {
                            logStream.sendAndLog(`Generated alt text for page ${page[0]} successfully, modified ${modifiedCount} images`);
                            if (typeof modifiedCount === "number") {
                                successfulImages += modifiedCount;
                            }
                        }
                    }

                    await _updateBatchUpdateJob(projectID, jobID, {
                        imageResults: errors.images,
                        successfulImagePages: successfulImages,
                        failedImagePages: failedImages,
                    });
                }

                // Create AI summary for each page
                if (generateResources?.summaries?.generate) {
                    const aiSummaryPromises = [];
                    for (const page of pageTextsMap) {
                        aiSummaryPromises.push(
                            _generatePageAISummary(
                                bookService,
                                page[0],
                                generateResources.summaries.overwrite ?? false,
                                page[1]
                            )
                        );
                    }

                    const aiSummaryResults = await Promise.allSettled(aiSummaryPromises);
                    for (let i = 0; i < aiSummaryResults.length; i++) {
                        const pageID = Array.from(pageTextsMap.keys())[i] || null;
                        if (!pageID) {
                            continue;
                        }
                        const aiSummaryRes = aiSummaryResults[i];
                        if (aiSummaryRes.status === "fulfilled") {
                            newPageDetails.push({
                                id: pageID,
                                summary: aiSummaryRes.value[1],
                            });
                        } else {
                            switch (aiSummaryRes.reason) {
                                case "location":
                                    errors.meta.location++;
                                    break;
                                case "empty":
                                    errors.meta.empty++;
                                    break;
                                case "internal":
                                default:
                                    errors.meta.internal++;
                                    break;
                            }

                            newPageDetails.push({
                                id: pageID,
                                summary: "",
                                error: aiSummaryRes.reason,
                            });
                        }
                    }
                }

                if (generateResources?.tags?.generate) {
                    const aiTagsResults: (["empty" | "internal" | null, string[]])[] = [];
                    for (const page of pageTextsMap) {
                        const result = await _generatePageAITags(
                            bookService,
                            page[0],
                            generateResources.tags.overwrite ?? false,
                            page[1]
                        ).catch((e) => {
                            logger.error({ err: e }, "result failed");
                            return ["internal", [] as string[]];
                        });
                        // @ts-ignore
                        aiTagsResults.push(result)
                    }

                    for (let i = 0; i < aiTagsResults.length; i++) {
                        const pageID = Array.from(pageTextsMap.keys())[i] || null;
                        const pageTagsRes = aiTagsResults[i];
                        logStream.sendAndLog(`Generated tags for page ${pageID}: ${JSON.stringify(pageTagsRes)}`);

                        if (!pageID) {
                            continue;
                        }

                        const found = newPageDetails.find((p) => p.id === pageID);
                        if (pageTagsRes[0] !== null) {
                            if (pageTagsRes[0] === "empty") {
                                errors.meta.empty++;
                            } else {
                                errors.meta.internal++;
                            }

                            // Update existing page details with error
                            if (found) {
                                found.error = pageTagsRes[0];
                                continue;
                            }

                            // Add new page details entry with error
                            newPageDetails.push({
                                id: pageID,
                                error: pageTagsRes[0],
                            });

                            continue;
                        }

                        // Update existing page details with tags
                        if (found) {
                            found.tags = pageTagsRes[1];
                            continue;
                        }

                        // Otherwise, add new page details entry with tags
                        newPageDetails.push({
                            id: pageID,
                            tags: pageTagsRes[1],
                        });
                    }
                }
            }

            // Do final page details updates
            let successfulMeta = 0;
            let failedMeta = 0;

            const withoutErrors = newPageDetails.reduce((acc, curr) => {
                if (curr.error) {
                    switch (curr.error) {
                        case "empty":
                            errors.meta.empty++;
                            break;
                        case "internal":
                        default:
                            errors.meta.internal++;
                            break;
                    }
                    return acc;
                }
                return [...acc, curr];
            }, [] as { id: string; summary?: string; tags?: string[] }[]);

            for (const page of withoutErrors) {
                // Set a random delay between 0 and 1s to avoid rate limiting
                const delay = Math.floor(Math.random() * 1000);
                await new Promise((resolve) => setTimeout(resolve, delay));

                const updateRes = await bookService.updatePageDetails(
                    page.id,
                    page.summary,
                    page.tags
                );
                if (updateRes[0] !== null) {
                    failedMeta++;
                    logStream.sendAndLog(`Failed to update page ${page.id} with error: ${updateRes[0]}`);
                    if (updateRes[0] === "location") {
                        errors.meta.location++;
                    }
                    if (updateRes[0] === "internal") {
                        errors.meta.internal++;
                    }
                } else {
                    logStream.sendAndLog(`Updated page ${page.id} successfully`);
                    successfulMeta++;
                }
            }

            logStream.sendAndLog(
                `Batch ${jobID} finished: ${successfulMeta} pages succeeded, failed ${failedMeta}`
            );

            // Final updates
            logStream.close();
            const logs = logStream.getLogs();
            await _updateBatchUpdateJob(projectID, jobID, {
                status: "completed",
                endTimestamp: new Date(),
                imageResults: errors.images,
                successfulImagePages: successfulImages,
                failedImagePages: failedImages,
                metaResults: errors.meta,
                successfulMetaPages: successfulMeta,
                failedMetaPages: failedMeta,
                logs,
            })


            const [metaResults, imageResults] = getResultsStrings(errors.meta, errors.images);
            const resultsString = [metaResults, imageResults]
                .filter((r) => r.length > 0)
                .join("; ");

            const book = await bookService.getBookRecord();
            const bookTitle = book?.title || "Unknown Book";

            if (dataSource === "generated") {
                const jobTypeString = jobType.map((t) => t).join(" and ");
                await mailAPI.sendBatchBookAIMetadataFinished(
                    emailsToNotify,
                    projectID,
                    jobID,
                    jobTypeString,
                    successfulMeta,
                    successfulImages,
                    resultsString,
                    bookTitle
                );
            } else {
                await mailAPI.sendBatchBookUpdateFinished(
                    emailsToNotify,
                    projectID,
                    jobID,
                    successfulMeta,
                    resultsString,
                    bookTitle
                );
            }
        } catch (e: any) {
            // Catch any errors and update job status
            await _updateBatchUpdateJob(projectID, jobID, {
                status: "failed",
                endTimestamp: new Date(),
                error: e.message ? e.message : e.toString(),
            });
        }
    } catch (err: any) {
        logger.error({ err }, "_runBulkUpdateJob failed");
    }
}

/**
 * Internal function to generate an AI summary for a page.
 * @param pageID - The page ID to generate a summary for.
 * @param overwrite - Whether to overwrite an existing summary.
 * @param _pageText - Text content of the page. Optional, and will be fetched if not provided.
 * @returns [error, summary] - Error message or null, and the generated summary.
 */
async function _generatePageAISummary(
    bookService: BookService,
    pageID: number | string,
    overwrite: boolean,
    _pageText?: string
): Promise<["empty" | "internal" | null, string]> {
    let error = null;
    let summary = "";
    let pageText = _pageText;
    try {
        // If existing summary and not overwriting, return it
        const { overview: existing } = await bookService.getPageOverview(
            pageID.toString()
        );
        if (existing && !overwrite) {
            return [null, existing];
        }

        // If no page text provided, fetch it
        if (!pageText) {
            pageText = await bookService.getPageTextContent(pageID.toString());
        }
        if (!pageText) {
            throw new Error("empty");
        }

        const aiService = new AIService();
        const chunks = await aiService.chunkText(pageText, 2000);
        if (chunks.length === 0) {
            throw new Error("empty");
        }

        const aiSummaryOutput = await aiService.generatePageOverview(chunks);

        if (aiSummaryOutput === "empty") {
            throw new Error("empty");
        } else if (aiSummaryOutput === "internal") {
            throw new Error("internal");
        } else {
            summary = aiSummaryOutput;
        }
    } catch (err: any) {
        error = err.message ?? "internal";
    }
    return [error, summary];
}

/**
 * Internal function to generate AI tags for a page.
 * @param pageID - The page ID to generate tags for.
 * @param overwrite - Whether to overwrite existing tags.
 * @param _pageText - Text content of the page. Optional, and will be fetched if not provided.
 * @returns [error, tags] - Error message or null, and the generated tags.
 */
async function _generatePageAITags(
    bookService: BookService,
    pageID: number | string,
    overwrite: boolean,
    _pageText?: string
): Promise<["empty" | "internal" | null, string[]]> {
    let error = null;
    let tags: string[] = [];
    let pageText = _pageText;
    try {
        const existing = await bookService.getPageTags(pageID.toString());
        const nonSystemTags = existing.filter((t) => !bookService.DISABLED_PAGE_TAG_PREFIXES.some((p) => t["@value"].startsWith(p)));
        if (nonSystemTags?.length > 0 && !overwrite) {
            return [null, []];
        }

        if (!pageText) {
            pageText = await bookService.getPageTextContent(pageID.toString());
        }
        if (!pageText) {
            throw new Error("empty");
        }

        const aiService = new AIService();
        const chunks = await aiService.chunkText(pageText, 2000);
        if (chunks.length === 0) {
            throw new Error("empty");
        }

        const tagsRes = await aiService.generatePageTags(chunks);
        if (tagsRes === "empty") {
            throw new Error("empty");
        }
        if (tagsRes === "error" || !Array.isArray(tagsRes)) {
            throw new Error("internal");
        }

        tags = tagsRes;
    } catch (err: any) {
        error = err.message ?? "internal";
    }
    return [error, tags];
}

/**
 * Internal function to generate AI tags for a page.
 * @param bookService - The BookService instance to use.
 * @param pageID - The page ID to generate tags for.
 * @param overwrite - Whether to overwrite existing tags.
 * @returns {[string|null, boolean, number]} - A tuple containing of [error message, success status, modified count], or undefined if an error occurred.
 */
async function _generateAndApplyPageImagesAltText(
    bookService: BookService,
    pageID: number | string,
    overwrite: boolean
): Promise<["empty" | "internal" | null, boolean, number]> {
    let error = null;
    let success = false;
    let modifiedCount = 0;
    try {
        const pageImageData = await bookService.getPageImages(pageID.toString());
        if (!pageImageData) {
            return [null, true, 0]; // If page doesn't have images, return success
        }

        const calcImages = (imagesRes: PageImagesRes): PageFile[] => {
            const arr = Array.isArray(imagesRes.file) ? imagesRes.file : [imagesRes.file];
            return arr.filter((f) => _checkCanEditAltText(f, overwrite));
        };

        const imageData = calcImages(pageImageData);

        const fileContentsPromises: Promise<string>[] = [];
        for (let i = 0; i < imageData.length; i++) {
            const fileID = imageData[i]["@id"];
            fileContentsPromises.push(
                bookService.getFileContent(pageID.toString(), fileID, "thumb")
            );
        }

        const fileContentsResults = await Promise.allSettled(fileContentsPromises);
        const fileContents: { fileID: string; contents: string }[] =
            fileContentsResults.map((r, idx) => {
                const fileID = imageData[idx]["@id"];
                if (r.status === "fulfilled") {
                    return { fileID, contents: r.value };
                }
                return { fileID, contents: "" };
            });

        // Initialize final results array
        const altTexts: _generatePageImagesAltTextResObj[] = [];

        const aiService = new AIService();

        // Purposely not using Promise.all here to avoid rate limiting issues (images use lots of tokens)
        for (let i = 0; i < imageData.length; i++) {
            const fileID = imageData[i]["@id"];
            const fileType = imageData[i]["contents"]["@type"];
            const fileSrc = imageData[i]["contents"]["@href"];
            const content = fileContents.find((f) => f.fileID === fileID)?.contents;

            if (!content) {
                altTexts.push({
                    fileID,
                    src: fileSrc,
                    altText: "",
                    error: "fetcherror",
                });
                continue;
            }

            const completion = await aiService.generateImageAltText(
                fileType,
                content,
                500
            );

            if (["empty", "error", "unsupported"].includes(completion)) {
                altTexts.push({
                    fileID,
                    src: fileSrc,
                    altText: "",
                    error: completion,
                });
                continue;
            }

            const findProperties = (): PageFileProperty[] => {
                const properties = imageData[i].properties?.property;
                if (!properties) return [];
                return Array.isArray(properties) ? properties : [properties];
            };

            const fileProperties = findProperties();
            const foundAlt = fileProperties.find((p) => p["@name"] === "alt");
            if (foundAlt) {
                if (overwrite) {
                    foundAlt.contents["#text"] = completion;
                }
            } else {
                // Add new alt property
                fileProperties.push({
                    "@revision": "",
                    "@href": "",
                    "@resid": "",
                    "@resource-is-deleted": "",
                    "@resource-rev-is-deleted": "",
                    "@etag": "",
                    "date.modified": "",
                    "@name": "alt",
                    contents: {
                        "@type": "text",
                        "@href": "",
                        "@size": "0",
                        "#text": completion,
                    },
                });
            }

            altTexts.push({
                fileID,
                src: fileSrc,
                altText: completion,
                properties: fileProperties,
            });
        }

        // Get page content and parse for image elements.
        // "edit" mode returns the authored source. The MindTouch default ("view") returns *rendered*
        // output with DekiScript/templates/transclusions already expanded, which would be baked into
        // the page source when we write the modified content back.
        const pageContent = await bookService.getPageContent(
            pageID.toString(),
            "json",
            "edit"
        );
        // Fragment mode (isDocument = false): parse5 would otherwise synthesize a full document, and
        // serializing that emits an <html><head/><body> wrapper. MindTouch strips those tags from
        // page content along with everything they contain, which blanks the page.
        const cheerioContent = cheerio.load(pageContent, null, false);
        const imageElements = cheerioContent("img");

        if (!imageElements || imageElements.length === 0) {
            return [null, true, 0]; // If we couldn't detect any images, return success
        }

        let didModify = false;
        for (let i = 0; i < altTexts.length; i++) {
            const file = altTexts[i];

            if (file.error || !file.altText) {
                continue;
            }

            const found = imageElements.filter((_, el) => {
                const src = cheerioContent(el).attr("src");
                if (!src) return false;
                return _srcMatchesFile(src, file.fileID, file.src);
            });

            if (!found || found.length === 0) {
                continue;
            }

            // Set new alt text
            found.each((_, el) => {
                // Authored (edit-mode) source may omit the attribute entirely, in which case
                // el.attribs["alt"] is undefined -- calling .endsWith() on it below would throw.
                const currElementAltText = el.attribs["alt"] ?? "";
                if (overwrite) {
                    cheerioContent(el).attr("alt", file.altText); // If overwrite is true, always update the alt text
                } else if (!currElementAltText.trim()) {
                    // Missing, empty, or whitespace-only alt is not real alt text, so fill it
                    // regardless of overwrite (for some reason many img's carry " " as alt text)
                    cheerioContent(el).attr("alt", file.altText);
                } else if (
                    aiService.supportedFileExtensions.some((ext) =>
                        currElementAltText.endsWith(`.${ext}`)
                    )
                ) {
                    // If the alt text ends with one of the supported file extensions, update it
                    // MindTouch sets the default alt text to the file name, so we'll consider it as junk and update it
                    cheerioContent(el).attr("alt", file.altText);
                }
                // If the alt text is not empty and overwrite is false, don't update it
            });
            didModify = true;
            modifiedCount++;
        }

        // Skipped entirely when nothing matched: there is no content change to write, but the file
        // properties below are still worth persisting.
        if (didModify) {
            // xmlMode serialization self-closes void elements (<img/>, <br/>) and escapes bare
            // ampersands so the <content><body>...</body></content> envelope stays well-formed XML.
            const modifiedContentXML = cheerioContent.html({ xmlMode: true });
            if (!modifiedContentXML) {
                return ["internal", false, 0];
            }

            // The regression this code replaced serialized a full <html><head/><body> document. That
            // preserved every character of text, so the text comparison below cannot see it -- the
            // content was destroyed by MindTouch, which strips these tags along with everything they
            // contain. Assert the payload is a bare fragment before it can reach the library again.
            if (/<\/?(?:html|head|body)[\s/>]/i.test(modifiedContentXML)) {
                logger.error(`Refusing to write alt text for page ${pageID}: serialized payload contains document wrapper tags`);
                return ["internal", false, 0];
            }

            // Separately, setting alt attributes only touches attributes, so the page's text must
            // survive intact. This catches the parser dropping content rather than mis-wrapping it.
            if (!_isContentPreserved(pageContent, modifiedContentXML)) {
                logger.error(`Refusing to write alt text for page ${pageID}: serialized content lost text (before: ${pageContent.length} chars, after: ${modifiedContentXML.length} chars)`);
                return ["internal", false, 0];
            }

            const updateSuccess = await bookService.updatePageContent(
                pageID.toString(),
                modifiedContentXML
            );
            if (!updateSuccess) {
                throw new Error("internal");
            }
        }

        // Only now that the page content is safely written (or that there was no content change to
        // make) is it safe to mark the files themselves as having alt text.
        await _applyFileAltTextProperties(bookService, altTexts);

        success = true;
    } catch (err: any) {
        error = err.message ?? "internal";
    }
    return [error, success, modifiedCount];
}

/**
 * Guards against the parser or serializer dropping content. Applying alt text only touches
 * attributes, so the rendered text of the page must survive essentially intact.
 *
 * Note this cannot detect content that survives serialization but is rejected by MindTouch --
 * the wrapper-tag assertion in the caller covers that case.
 */
function _isContentPreserved(before: string, after: string): boolean {
    const textOf = (html: string) =>
        cheerio.load(html, null, false).text().replace(/\s+/g, " ").trim();

    const beforeText = textOf(before);
    const afterText = textOf(after);

    // Nothing to compare against; the write guard in updatePageContent still applies.
    if (!beforeText.length) return true;

    if (!afterText.length) return false;

    return afterText.length >= beforeText.length * 0.5;
}

/**
 * Determines whether a page's `<img src>` refers to the given file.
 *
 * MindTouch file URLs embed the file ID (`/@api/deki/files/{fileID}/{filename}`), which is stable
 * across the files API href, the authored source, and rendered output. The rest of the path is not:
 * the API href is percent-encoded (a filename containing a space arrives as `%20`) while the
 * authored src may not be, and query params vary between the two.
 */
function _srcMatchesFile(src: string, fileID: string, fileHref: string): boolean {
    // Trailing slash matters: it stops file 120296 from matching file 1202960.
    if (src.includes(`/files/${fileID}/`)) return true;

    // Fall back to path comparison for any URL shape that doesn't embed the ID.
    try {
        return src.includes(new URL(fileHref).pathname);
    } catch {
        // Relative or malformed href; skip this image rather than failing the whole page.
        return false;
    }
}

/**
 * Persists generated alt text onto the MindTouch file records themselves.
 *
 * Call this only once the page content has been written. Doing it earlier means any later failure
 * leaves the `alt` property set while the page HTML still lacks it, and _checkCanEditAltText then
 * filters the image out of every future non-overwrite run.
 */
async function _applyFileAltTextProperties(
    bookService: BookService,
    altTexts: _generatePageImagesAltTextResObj[]
): Promise<void> {
    for (let i = 0; i < altTexts.length; i++) {
        const file = altTexts[i];
        if (file.error || !file.altText) {
            logger.error(`No alt text for image: ${file.fileID}, ${file.error}`);
            continue;
        }

        if (!file.properties) continue;

        const mappedProperties = file.properties.map((p) => ({
            etag: p["@etag"],
            name: p["@name"],
            value: p.contents["#text"],
        }));

        const res = await CXOneFetch({
            scope: "files",
            path: file.fileID,
            api: MindTouch.API.File.PUT_File_Properties,
            subdomain: bookService.library,
            options: {
                method: "PUT",
                body: MindTouch.Templates.PUT_FileProperties(mappedProperties),
                headers: {
                    "Content-Type": "application/xml",
                },
            },
        }).catch((e) => {
            logger.error({ detail: [file.fileID, e] }, "Error updating file properties for file");
            return { status: 500 };
        });

        if (res.status !== 200) {
            logger.error(`Error updating file properties for file: ${file.fileID}`);
        }
    }
}

function _checkCanEditAltText(file: PageFile, overwrite: boolean): boolean {
    // If overwriting is enabled, we can always edit
    if (overwrite) return true;

    // If no properties exist, we can edit (no existing alt text)
    if (!file.properties || !file.properties.property) return true;

    // Check if alt property exists with content
    if (Array.isArray(file.properties.property)) {
        const altTextPropertyExists = file.properties.property.some(
            (p) => p["@name"] === "alt" && p.contents["#text"]
        );
        return !altTextPropertyExists;
    }

    // Single property - check if it's an "alt" property with content
    const altTextPropertyExists = file.properties.property["@name"] === "alt" && file.properties.property.contents["#text"];
    return !altTextPropertyExists;
};

async function _createBatchUpdateJob(projectID: string, props: Pick<ProjectBookBatchUpdateJob, "type" | "dataSource" | "generateResources" | "ranBy">): Promise<ProjectBookBatchUpdateJob> {
    const job: ProjectBookBatchUpdateJob = {
        jobID: randomUUID(),
        type: props.type,
        status: "pending",
        dataSource: props.dataSource,
        generateResources: props.generateResources,
        ranBy: props.ranBy,
        startTimestamp: new Date(),
    };

    await Project.updateOne(
        {
            projectID: { $eq: projectID },
        },
        {
            $push: {
                batchUpdateJobs: job,
            },
        }
    );

    return job;
}

type UpdateBatchJobData = Partial<Pick<ProjectBookBatchUpdateJob, "status" | "endTimestamp" | "error" | "metaResults" | "imageResults" | "successfulMetaPages" | "failedMetaPages" | "successfulImagePages" | "failedImagePages" | "logs">>;
async function _updateBatchUpdateJob(projectID: string, jobID: string, data: UpdateBatchJobData): Promise<void> {
    const toSet = () => {
        const setData: Record<string, any> = {};
        // for each key in data, if it's defined, add it to setData
        (Object.keys(data) as (keyof UpdateBatchJobData)[]).forEach((key) => {
            if (data[key] !== undefined) {
                setData[`batchUpdateJobs.$[job].${key}`] = data[key];
            }
        });

        return setData;
    };

    await Project.updateOne({ projectID }, { $set: toSet() }, { arrayFilters: [{ "job.jobID": jobID }] });
}

const hasActiveBatchJob = (project: ProjectInterface): boolean => {
    if (!project.batchUpdateJobs || project.batchUpdateJobs.length === 0) {
        return false;
    }

    const activeJob = project.batchUpdateJobs.filter((j) =>
        ["pending", "running"].includes(j.status)
    );

    return activeJob.length > 0;
}

const getResultsStrings = (meta: { location: number; empty: number; internal: number } | undefined, images: { location: number; empty: number; internal: number } | undefined): string[] => {
    const parsedMetaResults: Record<string, any> = Object.entries(
        meta || {}
    ).filter(([_, value]) => value !== 0);
    const parsedImageResults: Record<string, any> = Object.entries(
        images || {}
    ).filter(([_, value]) => value !== 0);

    return [
        ...parsedMetaResults.map(([key, value]: [string, any]) => {
            return `${value} pages failed with error: ${key}`;
        }).join(", "),
        ...parsedImageResults.map(([key, value]: [string, any]) => {
            return `${value} images failed with error: ${key}`;
        }).join(", ")
    ]
}


class BatchJobLogStream {
    private session: Session;
    private pendingMessages: string[] = [];
    private logs: string[] = [];
    private batchSize = 5;

    constructor(session: Session) {
        this.session = session;
    }

    sendAndLog(message: string) {
        this.logs.push(`[${new Date().toISOString()}] ${message}`);
        this.pendingMessages.push(message);
        if (this.pendingMessages.length >= this.batchSize) {
            this.batchSend(this.pendingMessages);
            this.pendingMessages = [];
        }
    }

    getLogs() {
        return this.logs;
    }

    async batchSend(messages: string[]) {
        try {
            if (messages.length === 0) return;

            const buffer = createEventBuffer();
            messages.forEach((msg) => {
                buffer.push(msg);
            });

            if (!this.session.isConnected) {
                logger.warn("Session disconnected, cannot send batch log messages. This is not necessarily an error.");
                return;
            }

            await this.session.batch(buffer);
        } catch (e) {
            logger.error({ err: e }, "Error sending batch log messages");
        }
    }

    async close() {
        // Send any remaining messages
        await this.batchSend(this.pendingMessages);
    }
}

export default {
    getPageAISummary,
    generatePageImagesAltText,
    batchGenerateAIMetadata,
    batchUpdateBookMetadata,
    getPageAITags
}