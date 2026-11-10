import { Response } from "express";
import { z } from "zod";
import axios from "axios";
import { ZodReqWithUser } from "../types";
import BookService from "./services/book-service";
import { getLibraryAndPageFromBookID } from "../util/bookutils.js";
import conductorErrors from "../conductor-errors";
import { conductor404Err, conductor500Err } from "../util/errorutils";
import logger from "../logger.js";
import { reingestPageSchema } from "./validators/reingest";

const CHATBOT_URL = process.env.CHATBOT_REINGEST_URL;
const CHATBOT_KEY = process.env.CHATBOT_REINGEST_SERVICE_KEY;

/**
 * Ask the LibreTexts chatbot (Benny) to re-ingest a single page immediately,
 * rather than waiting for its periodic sweep. Offered to an author after they
 * edit a page in the library. Streams the chatbot's own pipeline progress (SSE)
 * straight back to the client — fetched -> chunked -> embedded -> indexed -> done.
 *
 * Trust model: the chatbot service key is held server-side and never reaches the
 * browser. Reaching this route means an authenticated Conductor user who can edit
 * the page (re-checked here via canAccessPage). The chatbot trusts our key; we
 * verify the human. It does not authorize the author itself, and it never learns
 * the author's identity — attribution of *who* stays here in Conductor.
 *
 * Re-ingest is idempotent and cheap when nothing changed (content is
 * hash-addressed downstream), so offering it broadly is safe.
 */
async function reingestPage(
  req: ZodReqWithUser<z.infer<typeof reingestPageSchema>>,
  res: Response
) {
  try {
    if (!CHATBOT_URL || !CHATBOT_KEY) {
      return res.status(503).send({
        err: true,
        errMsg: "Benny re-ingest is not configured on this environment.",
      });
    }

    const { bookID, pageID } = req.params;
    const [library, coverID] = getLibraryAndPageFromBookID(bookID);
    if (!library || !coverID) return conductor404Err(res);

    // Defense in depth: the user reached the editor via project membership, but
    // re-confirm they may edit THIS page before vouching to the chatbot.
    const bookService = new BookService({ bookID });
    const canAccess = await bookService.canAccessPage(
      req.user.decoded.uuid,
      pageID
    );
    if (!canAccess) {
      return res.status(403).send({ err: true, errMsg: conductorErrors.err8 });
    }

    const upstream = await axios.post(
      `${CHATBOT_URL}/api/pages/${encodeURIComponent(pageID)}/reingest`,
      undefined,
      {
        params: { library },
        headers: {
          "X-Reingest-Service-Key": CHATBOT_KEY,
          Accept: "text/event-stream",
        },
        responseType: "stream",
        validateStatus: () => true, // handle non-200 ourselves
      }
    );

    // Resolution errors (404 not-ingested / 429 busy / 401 / 503) arrive as JSON
    // before any stream opens — forward the status and message.
    if (upstream.status !== 200) {
      const chunks: Buffer[] = [];
      for await (const chunk of upstream.data) chunks.push(chunk as Buffer);
      let errMsg = `Benny re-ingest failed (${upstream.status}).`;
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString());
        if (parsed?.detail) errMsg = parsed.detail;
      } catch {
        /* non-JSON body; keep the generic message */
      }
      return res.status(upstream.status).send({ err: true, errMsg });
    }

    // Same SSE frame format the client already consumes — pipe it through.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    upstream.data.pipe(res);
    upstream.data.on("end", () => res.end());
    // Client went away mid-stream — stop pulling from the chatbot.
    res.on("close", () => {
      upstream.data.destroy?.();
    });
  } catch (e) {
    logger.error({ err: e }, "reingestPage failed");
    if (!res.headersSent) return conductor500Err(res);
    res.end();
  }
}

export default { reingestPage };
