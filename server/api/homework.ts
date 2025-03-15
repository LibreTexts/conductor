import b62 from "base62-random";
import axios from "axios";
import Homework, { HomeworkInterface } from "../models/homework.js";
import conductorErrors from "../conductor-errors.js";
import { debugError, debugADAPTSync, debugServer } from "../debug.js";
import alertsAPI from "./alerts.js";
import { Request, Response } from "express";
import { Subtract } from "../types/Misc.js";
import { Document } from "mongoose";
import { AnyBulkWriteOperation } from "mongodb";

type RawHomeworkInterface = Subtract<HomeworkInterface, Document>;

/**
 * Get all Homework resources.
 */
const getAllHomework = async (_req: Request, res: Response) => {
  try {
    const homework = await Homework.aggregate([
      {
        $match: {},
      },
      {
        $sort: {
          title: 1,
        },
      },
      {
        $project: {
          __id: 0,
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);

    return res.send({
      err: false,
      homework,
    });
  } catch (err) {
    debugError(err);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Get Homework resources originating from the ADAPT servers.
 */
const getADAPTCatalog = async (_req: Request, res: Response) => {
  try {
    const courses = await Homework.aggregate([
      {
        $match: {
          kind: "adapt",
        },
      },
      {
        $sort: {
          title: 1,
        },
      },
      {
        $project: {
          __id: 0,
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);

    return res.send({
      err: false,
      courses,
    });
  } catch (err) {
    debugError(err);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Queries the ADAPT server for ADAPT Commons courses and their assignments,
 * then upserts them into the Homework collection (as kind: 'adapt').
 *
 */
const syncADAPTCommons = async (): Promise<{
  err: boolean;
  msg?: string;
  errMsg?: string;
}> => {
  let rawCourseCount = 0;
  let updatedCount = 0;
  try {
    const adaptURL =
      "https://adapt.libretexts.org/api/courses/commons-courses-and-assignments-by-course";

    const adaptRes = await axios.get<ADAPTCommonsCoursesResponse>(adaptURL);

    const rawCourses = adaptRes.data.commons_courses_and_assignments_by_course;
    rawCourseCount = rawCourses.length || 0;

    const mappedCourses: Omit<RawHomeworkInterface, "hwID">[] = rawCourses.map(
      (course) => {
        return {
          title: course.course_name,
          kind: "adapt",
          externalID: course.course_id.toString(),
          description: course.course_description,
          adaptAssignments: course.assignments.map((a) => {
            return {
              title: a.name,
              description: a.description || "",
            };
          }),
          adaptOpen: course.anonymous_users === "1",
        };
      }
    );

    const adaptOps: AnyBulkWriteOperation[] = [];
    mappedCourses.forEach((course) => {
      adaptOps.push({
        updateOne: {
          filter: {
            kind: "adapt",
            externalID: course.externalID,
          },
          update: {
            $setOnInsert: {
              hwID: b62(11),
              externalID: course.externalID,
            },
            $set: {
              title: course.title,
              description: course.description,
              adaptAssignments: course.adaptAssignments,
              adaptOpen: course.adaptOpen,
            },
          },
          upsert: true,
        },
      });
    });

    if (adaptOps.length === 0) {
      return {
        err: false,
        msg: "No ADAPT courses found.",
      };
    }

    const upsertRes = await Homework.bulkWrite(adaptOps, {
      ordered: false,
    });

    const upsertedIds: string[] = Object.keys(upsertRes.upsertedIds).map(
      // @ts-ignore
      (key) => upsertRes.upsertedIds[key]
    );

    if (upsertedIds.length > 0) {
      // @ts-ignore
      await alertsAPI.processInstantHomeworkAlerts(upsertedIds);
    }

    updatedCount = upsertRes.modifiedCount || 0;
    let msg = "Succesfully synced ADAPT courses & assignments.";
    if (updatedCount > 0) msg += ` ${updatedCount} courses updated.`;
    return {
      err: false,
      msg: msg,
    };
  } catch (err: any) {
    if (err.result) {
      // bulkWrite errors
      if (err.result.nInserted > 0) {
        // Some succeeded
        debugADAPTSync(
          `Inserted only ${err.results.nInserted} courses when ${rawCourseCount} were expected.`
        );
        return {
          err: false,
          msg: `Imported ${err.results.nInserted} courses and their assignments from ADAPT.`,
        };
      } else {
        return {
          err: true,
          errMsg: conductorErrors.err15,
        };
      }
    } else if (err.message && err.message === "adaptcommons") {
      // get request error
      return {
        err: true,
        errMsg: conductorErrors.err14,
      };
    } else {
      // other errors
      debugError(err);
      return {
        err: true,
        errMsg: conductorErrors.err6,
      };
    }
  }
};

/**
 * Triggers syncs with all applicable, connected Homework systems.
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const syncHomework = async (_req: Request, res: Response) => {
  try {
    const adaptRes = await syncADAPTCommons();
    return res.send(adaptRes);
  } catch (err) {
    debugError(err);
    return res.send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
};

/**
 * Runs the Homework system(s) sync job(s) via on trigger from an automated requester (e.g. schedule service).
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const runAutomatedHomeworkSync = (req: Request, res: Response) => {
  debugServer(
    `Received automated request to sync Commons with Homework systems ${new Date().toLocaleString()}`
  );
  return syncHomework(req, res);
};

export default {
  getAllHomework,
  getADAPTCatalog,
  syncHomework,
  runAutomatedHomeworkSync,
};
