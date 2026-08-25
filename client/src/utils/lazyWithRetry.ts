import { lazy, type ComponentType } from "react";
import {
  beginChunkImportRetry,
  endChunkImportRetry,
  isChunkLoadError,
  reloadForNewBuild,
} from "./chunkErrorRecovery";

type Importer<T extends ComponentType<any>> = () => Promise<{ default: T }>;

const RETRY_DELAY_MS = 400;

async function loadWithRetry<T extends ComponentType<any>>(
  importer: Importer<T>
): Promise<{ default: T }> {
  beginChunkImportRetry();
  try {
    try {
      return await importer();
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      try {
        return await importer();
      } catch {
        // Only a missing chunk is fixable by reloading. A module that throws while
        // evaluating will throw again after a reload, so don't destroy the user's page
        // state for it: let the error boundary report it instead.
        if (isChunkLoadError(err)) reloadForNewBuild();
        throw err;
      }
    }
  } finally {
    endChunkImportRetry();
  }
}

/**
 * Drop-in replacement for React.lazy that retries the dynamic import once before failing.
 *
 * A rolling deploy briefly serves both the old and new build behind the load balancer, so a
 * chunk request can land on a task that doesn't have that hash yet and 404. A single retry
 * usually lands on a healthy task, and the user never sees anything. Only when the retry
 * also fails is the chunk genuinely gone (the tab is running a build that no longer exists),
 * and only then do we reload into the current build. If the reload cooldown refuses, the
 * original error propagates to the error boundary, which offers a manual reload.
 */
export default function lazyWithRetry<T extends ComponentType<any>>(
  importer: Importer<T>
) {
  return lazy(() => loadWithRetry(importer));
}
