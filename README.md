# LibreTexts Conductor Platform

This repository houses the codebase for the LibreTexts Conductor Platform, which powers:

* The Conductor application itself
* The LibreCommons
* Campus Commons instances
* Campus Conductor instances
* LibreTexts Adoption Reporting
* LibreTexts OER Integration Requests

A single codebase serves every tenant. The boot-required `ORG_ID` environment variable selects which organization the running instance represents (`libretexts` for LibreCommons, a campus slug otherwise). `server.ts` exits immediately if it is missing.

---

## Repository layout

This is a monorepo with two independently built packages. The repository root holds only tooling (Husky, commitlint) and has no source dependencies, so `npm install` must be run inside `client/` and `server/` separately.

```
client/     Vite + React + TypeScript SPA
server/     Express + TypeScript, native ESM
```

## Getting started

Requires Node 22 and access to a MongoDB instance (Atlas in every deployed environment).

```bash
cd server && npm install
cd ../client && npm install
```

Copy `client/.env.dist` to `client/.env` and fill it in. The server reads `server/.env` via dotenv;

**Server** (from `server/`):

| Command | What it does |
| --- | --- |
| `npm run dev` | `tsx watch server.ts` piped through `pino-pretty`, hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `tsup` (ESM bundle + d.ts) then `tsc-alias`, output to `server/dist` |
| `npm run start:prod` | Runs the built `dist/server.js` |

**Client** (from `client/`):

| Command | What it does |
| --- | --- |
| `npm start` | Vite dev server on port 3000, proxying API calls to `VITE_DEV_BASE_URL` |
| `npm run build` | `tsc && vite build`, bundling to `client/dist` |
| `npm test` | Vitest (jsdom + Testing Library) |
| `npm run test:watch` | Vitest in watch mode |

Run a single client test with `npm test -- src/path/to/file.test.tsx` or `npx vitest run -t "test name"`. There is currently no server test suite.

---

## Client standards

These apply to all new UI. Large parts of the app predate them, so expect to encounter the older patterns described under [Legacy surface area](#legacy-surface-area). When you touch legacy code, migrate the piece you are touching rather than extending the old pattern (unless you're only hotfixing).

### 1. Davis Design System for all new UI

New components come from [`@libretexts/davis-react`](https://davis.libretexts.org) (with `@libretexts/davis-react-table` for data tables and `@libretexts/davis-core` for tokens). LLM's can read the docs at `https://davis.libretexts.org/llms.txt`.

```tsx
import { Button, Stack, Badge } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
```

Do not build new UI with Semantic UI React, and do not add local workarounds for upstream Davis bugs. If Davis is missing something or is broken, label the spot as pending a Davis fix and raise it as an issue upstream. All UI must meet WCAG 2.2 AA, which includes fixing inaccessible legacy markup you touch.

### 2. React Query for all server state

Data fetching, caching, and mutations go through `@tanstack/react-query`. The `QueryClient` is configured in `Platform.tsx` and its `QueryCache.onError` handler surfaces a toast automatically, reading the message from `meta.errorMessage` when a query provides one. Do not hold server data in Redux or in ad-hoc `useState` + `useEffect` fetches.

Colocate hooks with the feature (e.g. `components/Home/PinnedProjects/hooks.ts`):

```ts
export function usePinnedProjects() {
  return useQuery<User["pinnedProjects"]>({
    queryKey: ["pinnedProjects"],
    queryFn: async () => {
      const res = await api.getPinnedProjects();
      if (res.data.err) throw new Error(res.data.errMsg);
      return alphabetize(res.data.pinned);
    },
    staleTime: 1000 * 60 * 5,
  });
}
```

Redux (`client/src/state/`) remains the home for organization, user, and global UI state only.

### 3. Every backend call belongs in `src/api.ts`

`client/src/api.ts` exports a singleton `API` class instance. Add a typed method there and call `api.<method>()` from hooks and components. Do not write `axios.get("/some/route")` inside a component.

```ts
// client/src/api.ts
async getFramework(id: string) {
  const res = await axios.get<{ framework: AssetTagFramework } & ConductorBaseResponse>(
    `/assettagframeworks/${id}`
  );
  return res;
}
```

The class deliberately does not create its own Axios instance, because not every call site has been migrated yet and the global Axios config in `Platform.tsx` (base URL, `withCredentials`, the 401 logout interceptor) still needs to apply everywhere. Routes that bypass Express's default body parser use the private `streamJson` helper instead of Axios.

### 4. `useNotifications` and `useModals`

Toasts go through `useNotifications()` from `context/NotificationContext`, which is backed by the Davis `ToastContainer` mounted in `NotificationsProvider`:

```ts
const { addNotification } = useNotifications();
addNotification({ type: "success", message: "Project updated." });
```

Modals go through `useModals()` from `context/ModalContext`. The provider keeps a keyed map of open modals, so you render the modal component into `openModal` and dismiss it by id (or `closeAllModals`) rather than threading `open`/`setOpen` state through the tree:

```ts
const { openModal, closeModal } = useModals();
openModal(<ConfirmModal onCancel={() => closeModal("confirm-delete")} />, "confirm-delete");
```

### 5. `useGlobalError` for error presentation

`useGlobalError()` (`components/error/ErrorHooks.ts`) dispatches into the Redux error slice, which renders the single global `ErrorModal` mounted in `Platform.tsx`. Pass the raw error to `handleGlobalError`; it unwraps the Conductor response shape (`errMsg`, `errors[]`, status codes) for you.

```ts
const { handleGlobalError } = useGlobalError();

try {
  await api.updateProject(id, values);
} catch (err) {
  handleGlobalError(err);
}
```

Use notifications for routine success and low-stakes failure feedback, and `useGlobalError` when an operation failed in a way the user has to acknowledge.

---

## Server standards

Request flow: `server.ts` (Helmet CSP, trust proxy, Mongo connect with retry, static client serving, SPA fallback) mounts the API under `/api/v1`. Every route is declared in `server/api.js`, which wires each path to its middleware chain and handler.

The standard chain is **authorize → validate → handle**.

### 1. Zod for request validation and type inference

Validators live in `server/api/validators/*` and are mounted with `middleware.validateZod`. Schemas are shaped around the Express request (`body`, `params`, `query`), which lets the handler infer its own request type from the same schema. This is the single source of truth for a route's input contract, so there is no separate interface to keep in sync.

```ts
// server/api/validators/store.ts
export const GetStoreProductSchema = z.object({
  params: z.object({
    product_id: z.string().min(1, "Product ID is required"),
  }),
});
```

```js
// server/api.js
router.route("/store/checkout/session").post(
  authAPI.optionalVerifyRequest,
  authAPI.optionalGetUserAttributes,
  middleware.validateZod(storeValidators.CreateCheckoutSessionSchema),
  storeAPI.createCheckoutSession
);
```

```ts
// server/api/store.ts
export async function getStoreProduct(
  req: z.infer<typeof GetStoreProductSchema>,
  res: Response
) { /* req.params.product_id is typed */ }
```

For authenticated routes, use the helpers in `server/types/Express.ts` (`ZodReqWithUser`, `ZodReqWithOptionalUser`, `TypedReqWithUser`, and friends) so `req.user` is typed alongside the validated payload. Older routes still use `express-validator` chains plus `middleware.checkValidationErrors`; new routes should not. When you touch a route, migrate it to Zod if/when appropriate.

### 2. Meilisearch for search indexes

`server/api/services/search-service.ts` owns a singleton `SearchService` wrapping the Meilisearch client (`MEILISEARCH_URL`, `MEILISEARCH_API_KEY`). Indexes are declared in the `INDEXES` tuple with their primary keys in `INDEX_PRIMARY_KEYS`, which keeps `addDocuments`, `search`, and `getIndexStats` tuple-typed against the real index names.

Filters are built through `buildFilterString`, which accepts plain objects, operator objects (`$eq`, `$in`, `$gt`, `$exists`, …), logical combinators (`$and`, `$or`, `$not`), or a raw filter string. Do not hand-concatenate Meilisearch filter syntax at call sites.

When a domain writes records that must be searchable, keep the index write next to the domain service (see `store-order-search-service.ts` called from `store-service.ts`) rather than scattering index calls through handlers.

### 3. `@libretexts/cxone-expert-node` for library access

All CXOne (MindTouch) interaction goes through the SDK, not hand-rolled Deki requests. `server/util/ExpertWithSSM.ts` is the singleton that pulls per-library API credentials from AWS SSM Parameter Store and vends a configured `Expert` client per library subdomain, caching both for 30 minutes:

```ts
const expert = await ExpertWithSSM.getInstance().forLibrary("chem");
```

If the SDK is missing an endpoint, raise it upstream. Avoid hand-rolling Deki requests in the server code. The SDK is typed, so you get better typesafety and DX.

Library API loops must be throttled to roughly 500ms between per-book requests, using one shared throttle rather than one per library.

### 4. Pino for logging and request tracing

`server/logger.ts` is the only logging entry point. There is no `console.*` in server code. Bindings object first, human-readable message last, and errors always under `err` so the stack survives:

```ts
logger.info("Sync finished");
logger.info({ books: 12 }, "Sync finished");
logger.error({ err }, "Failed to update project");
```

Tag a subsystem with `childLogger("store")` instead of prefixing messages with `[STORE]`, because `component` is a queryable CloudWatch field and a string prefix is not. Inside a request, `reqId`, `method`, `route`, and `userUUID` are attached automatically by `server/request-context.ts`; never pass them by hand. The logger redacts common secret keys (`password`, `token`, `apiKey`, cookies, auth headers), but that is a pragmatic net rather than a guarantee, so do not put secrets into bindings.

Levels: `fatal` for a process going down, `error` for an operation that failed and needs a human, `warn` for degraded but self-healing behavior (this is where swallowed nicety and telemetry failures belong), `info` for lifecycle and notable state changes, `debug` for verbose flow. `LOG_LEVEL` overrides the default, which is `info` in production and `debug` otherwise.

### 5. Controller / service / model

Domains split three ways:

```
server/api/store.ts                    controller: parse the validated request, shape the response
server/api/services/store-service.ts   service: business logic and external integrations
server/models/storeorder.ts            model: Mongoose schema and persistence
```

Controllers stay thin. They read from the inferred request type, call one or more services, and return a Conductor response envelope (`{ err, message, ...payload }`), catching at the boundary with `logger.error({ err }, "...")` and the helpers in `util/errorutils` (`conductor400Err`, `conductor404Err`, `conductor500Err`). Services hold the logic and are the only place that talks to third parties (Stripe, Lulu, Slack, Qdrant, OpenAI, central identity). Models own the schema.

Backend services live at `server/api/services/`, colocated with the route handlers, not at `server/services/`.

Nicety features (analytics, suggestion lookups, etc.) must never break a core path. Fire and forget, swallow the error, and log with `warn`.

---

## Cross-cutting conventions

**The server is native ESM** (`"type": "module"`). Local imports of TypeScript files use the `.js` extension: `import authAPI from "./api/auth.js"` resolves to `auth.ts`. Always write `.js` in local import specifiers even when the target is `.ts`. Missing this can break the build.

**Mixed `.js` and `.ts` in the server.** `allowJs` is on and several active route files are still plain JavaScript (`api.js`, `api/projects.js`, `api/users.js`). Both are first-class. New code is TypeScript, and the server tsconfig is `strict` with `noImplicitAny`.

**Conventional Commits are enforced.** Husky's `commit-msg` hook runs commitlint against `@commitlint/config-conventional`, and `semantic-release` cuts versions from `master` based on commit types. Match the existing style: `fix(a11y): ...`, `feat(projects): ...`, `chore(deps): ...`.

## Client architecture

`index.jsx` mounts `Platform.tsx`, which configures global Axios, wraps the app in React Query, Redux, and the context providers, and splits routing three ways with a `<Switch>`:

* **Commons** (`Commons.tsx`) for the public catalog, collections, book, and library routes
* **Standalone** (`Standalone.jsx`) for isolated pages such as `/adopt`, `/accessibility`, and peer-review submission
* **Conductor** (`Conductor.jsx`) for the authenticated application, and the catch-all fallback

Components are grouped by domain under `client/src/components/`, screens under `client/src/screens/{commons,conductor}`, providers under `client/src/providers/`, and contexts under `client/src/context/`.

## AI and agent stack

`server/api/kb.ts` together with `services/agent.ts` and `services/ai-service.ts` build on LangChain and LangGraph with a Qdrant vector store and OpenAI. The agent graph is sketched in `server/agent-graph.mmd`. This is an experimental feature for support and knowledge base search, and is not yet a production-facing.

## Build and runtime

Production is a multi-stage Docker build on Node 22 Alpine: build the client, build the server, then a production image that runs `node dist/server.js`, serves the built client from `client/dist`, exposes port 5000, and answers `/health` with a Mongo connectivity check. New Relic instrumentation loads only when `NODE_ENV === "production"`.

Runtime frontend configuration is injected at `/env.js` as `window.__APP_ENV__` rather than baked into the bundle, and only variables prefixed with `CLIENT__` are exposed to the frontend. This is used as an alternative to Vite's `import.meta.env` for runtime configuration, because Vite's env is baked into the bundle at build time.

## Legacy surface area

Knowing what is on the way out is as useful as knowing the standards:

* **Semantic UI React** and **Tailwind v4** still ship alongside Davis during the migration. **Do not write new Semantic UI.**
* **`NextGenComponents/`, `NextGenInputs/`, and `ControlledInputs/`** are the pre-Davis in-house component sets. `NextGenInputs` is slated for deprecation. Replace them with Davis equivalents as you go.
* **Direct `axios` calls in components** predate `src/api.ts`. Move them into the API class when you touch them.
* **`express-validator` chains** predate Zod. Convert them when you touch the route.
* **`server/migrations/*`** are standalone scripts for data backfills and transforms, run manually rather than by a migration runner.
