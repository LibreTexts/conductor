import Book from "../models/book.js";
import conductorErrors from "../conductor-errors.js";
import Homework from "../models/homework.js";
import Project from "../models/project.js";
import { debugError } from "../debug.js";

async function getConductorMetrics(req, res) {
  try {
    let bookPromise = Book.collection.estimatedDocumentCount();
    let hwPromise = Homework.collection.estimatedDocumentCount();
    let projectsPromise = Project.collection.estimatedDocumentCount();

    let metricsRes = await Promise.all([
      bookPromise,
      hwPromise,
      projectsPromise,
    ]);
    return res.send({
      bookCount: metricsRes[0],
      hwCount: metricsRes[1],
      projectCount: metricsRes[2],
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

export default {
  getConductorMetrics,
};
