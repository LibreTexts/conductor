import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import EditH5P from "./Edit";

const EDITOR = "https://studio.example.test";

const api = vi.hoisted(() => ({
  getActivityForEditing: vi.fn(),
  getActivitySubjects: vi.fn(),
  getActivityEditorToken: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
}));
const config = vi.hoisted(() => ({ authoring: true, origin: "https://studio.example.test", verified: true }));

vi.mock("../../../api", () => ({ default: api }));
vi.mock("../../../hooks/useClientConfig", () => ({
  default: () => ({
    clientConfig: { h5p_embed_origin: config.origin, h5p_authoring_enabled: config.authoring },
    loading: false,
    isProduction: true,
  }),
}));
vi.mock("../../../state/hooks", () => ({
  useTypedSelector: (select: (state: any) => unknown) => select({ user: { verifiedInstructor: config.verified } }),
}));
vi.mock("usehooks-ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("usehooks-ts")>()),
  useMediaQuery: () => true,
}));

let location: { pathname: string } = { pathname: "" };
function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Route exact path={["/h5p/new", "/h5p/:activityID/edit"]} component={EditH5P} />
        <Route path="*" render={({ location: l }) => { location = l; return null; }} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** The editor iframe, with a spy on what Conductor posts into it. */
function editorFrame() {
  const iframe = screen.getByTitle("H5P editor") as HTMLIFrameElement;
  const posted = vi.spyOn(iframe.contentWindow!, "postMessage");
  return { iframe, posted };
}

/** Delivers a message as if the H5P editor page sent it. */
function fromEditor(iframe: HTMLIFrameElement, data: Record<string, unknown>, origin = EDITOR) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin, source: iframe.contentWindow }));
  });
}

const sentOfType = (posted: { mock: { calls: unknown[][] } }, type: string): any[] =>
  posted.mock.calls.map((call) => call[0] as any).filter((m: any) => m?.type === type);

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  config.authoring = true;
  config.origin = EDITOR;
  config.verified = true;
  api.getActivitySubjects.mockResolvedValue({ data: { subjects: ["Biology", "Chemistry"] } });
  api.getActivityEditorToken.mockResolvedValue({ data: { token: "create-token", expiresAt: "", ttlSeconds: 900 } });
  api.updateActivity.mockResolvedValue({ data: { err: false } });
});

describe("Create H5P", () => {
  it("frames the new-activity editor and answers its ready with a token, only from the editor's origin", async () => {
    renderAt("/h5p/new");
    const { iframe, posted } = editorFrame();
    expect(iframe.getAttribute("src")).toBe(`${EDITOR}/h5p/new/edit`);

    fromEditor(iframe, { type: "ready", mode: "new" }, "https://evil.example.test");
    await new Promise((r) => setTimeout(r, 20));
    expect(api.getActivityEditorToken).not.toHaveBeenCalled();

    fromEditor(iframe, { type: "ready", mode: "new" });
    await waitFor(() => expect(posted).toHaveBeenCalledWith({ type: "token", token: "create-token" }, EDITOR));
    expect(api.getActivityEditorToken).toHaveBeenCalledWith(undefined);
  });

  it("requires a subject before anything is created", async () => {
    renderAt("/h5p/new");
    const { iframe } = editorFrame();
    fromEditor(iframe, { type: "loaded", title: "", displayOptions: { frame: true, download: true, embed: true, copyright: true } });
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Choose a subject before saving.")).toBeInTheDocument();
    expect(api.createActivity).not.toHaveBeenCalled();
  });

  it("creates the activity, hands the editor its edit token, saves, then records what was saved", async () => {
    api.createActivity.mockResolvedValue({ data: { activity: { activityID: "NewAct01", h5pContentID: 31484 }, token: "edit-token", expiresAt: "", ttlSeconds: 900 } });
    renderAt("/h5p/new");
    const { iframe, posted } = editorFrame();
    fromEditor(iframe, { type: "loaded", title: "", displayOptions: { frame: true, download: true, embed: true, copyright: true } });
    fromEditor(iframe, { type: "title", title: "Cell basics" });
    await screen.findByRole("option", { name: "Biology" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Subject/ }), "Biology");
    await userEvent.click(screen.getByRole("checkbox", { name: /Allow download/ }));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(sentOfType(posted, "save")).toHaveLength(1));
    expect(api.createActivity).toHaveBeenCalledWith(expect.objectContaining({ subjects: ["Biology"], visibility: "private" }));
    const tokenIndex = posted.mock.calls.findIndex(([m]) => (m as any).token === "edit-token");
    const saveIndex = posted.mock.calls.findIndex(([m]) => (m as any).type === "save");
    expect(tokenIndex).toBeGreaterThan(-1);
    expect(tokenIndex).toBeLessThan(saveIndex);
    const save = sentOfType(posted, "save")[0];
    expect(save.displayOptions).toEqual({ frame: true, download: false, embed: true, copyright: true });

    fromEditor(iframe, { type: "saved", requestId: save.requestId, contentId: "31484", title: "Cell basics", library: "H5P.MultiChoice 1.16", license: "CC BY", licenseVersion: "4.0", authors: [{ name: "Ada" }] });
    await waitFor(() => expect(api.updateActivity).toHaveBeenCalled());
    expect(api.updateActivity).toHaveBeenCalledWith("NewAct01", expect.objectContaining({
      subjects: ["Biology"],
      contentSaved: expect.objectContaining({ title: "Cell basics", library: "H5P.MultiChoice 1.16", license: "CC BY" }),
    }));
    await waitFor(() => expect(location.pathname).toBe("/h5p/NewAct01/edit"));
    expect(screen.getByTitle("H5P editor")).toBe(iframe);
  });

  it("is unavailable when authoring is switched off for this deployment", async () => {
    config.authoring = false;
    renderAt("/h5p/new");
    expect(await screen.findByText("The H5P editor isn't available")).toBeInTheDocument();
    expect(screen.queryByTitle("H5P editor")).toBeNull();
  });

  it("is open to verified instructors only, and asks for no token otherwise", async () => {
    config.verified = false;
    renderAt("/h5p/new");
    expect(await screen.findByText("Creating H5P activities is open to verified instructors")).toBeInTheDocument();
    expect(screen.queryByTitle("H5P editor")).toBeNull();
    expect(api.getActivityEditorToken).not.toHaveBeenCalled();
  });
});

describe("Edit H5P", () => {
  const editable = (role: "owner" | "collaborator") => ({
    data: {
      activity: {
        activityID: "AbCd1234", h5pContentID: 101, title: "Regulations on Fintech", subjects: ["Business"], tags: ["fintech"],
        language: "en", visibilityLevel: "public", license: { name: "CC BY", version: "4.0" }, h5pAuthors: JSON.stringify([{ name: "Sophie K" }]),
        updatedAt: "2026-10-24T15:12:00.000Z",
      },
      role,
      people: [{ uuid: "o", name: "Sophie K", role: "owner" }, { uuid: "c", name: "Jake Turner", role: "collaborator" }],
    },
  });

  it("frames the activity's editor, requests an edit token, and shows owner-only delete", async () => {
    api.getActivityForEditing.mockResolvedValue(editable("owner"));
    api.getActivityEditorToken.mockResolvedValue({ data: { token: "edit-token", expiresAt: "", ttlSeconds: 900 } });
    renderAt("/h5p/AbCd1234/edit");
    const iframe = (await screen.findByTitle("H5P editor")) as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe(`${EDITOR}/h5p/101/edit`);
    fromEditor(iframe, { type: "ready", mode: "edit" });
    await waitFor(() => expect(api.getActivityEditorToken).toHaveBeenCalledWith("AbCd1234"));
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete H5P" })).toBeInTheDocument();
    // The License section starts collapsed, as in the design.
    await userEvent.click(screen.getByRole("button", { name: /License and attribution/ }));
    expect(await screen.findByText(/Regulations on Fintech by Sophie K, is shared under a CC BY 4.0 license/)).toBeInTheDocument();
  });

  it("lets a collaborator who isn't a verified instructor edit", async () => {
    config.verified = false;
    api.getActivityForEditing.mockResolvedValue(editable("collaborator"));
    renderAt("/h5p/AbCd1234/edit");
    expect(await screen.findByTitle("H5P editor")).toBeInTheDocument();
  });

  it("does not offer delete to a collaborator", async () => {
    api.getActivityForEditing.mockResolvedValue(editable("collaborator"));
    renderAt("/h5p/AbCd1234/edit");
    await screen.findByTitle("H5P editor");
    expect(screen.queryByRole("button", { name: "Delete H5P" })).toBeNull();
  });

  it("refreshes the token when the editor says it is expiring", async () => {
    api.getActivityForEditing.mockResolvedValue(editable("owner"));
    api.getActivityEditorToken.mockResolvedValue({ data: { token: "fresh-token", expiresAt: "", ttlSeconds: 900 } });
    renderAt("/h5p/AbCd1234/edit");
    const iframe = (await screen.findByTitle("H5P editor")) as HTMLIFrameElement;
    const posted = vi.spyOn(iframe.contentWindow!, "postMessage");
    fromEditor(iframe, { type: "token-expiring" });
    await waitFor(() => expect(posted).toHaveBeenCalledWith({ type: "token", token: "fresh-token" }, EDITOR));
  });

  it("retries only the details when the content saved but the details did not", async () => {
    api.getActivityForEditing.mockResolvedValue(editable("owner"));
    api.updateActivity.mockRejectedValueOnce(new Error("boom"));
    renderAt("/h5p/AbCd1234/edit");
    const iframe = (await screen.findByTitle("H5P editor")) as HTMLIFrameElement;
    const posted = vi.spyOn(iframe.contentWindow!, "postMessage");
    fromEditor(iframe, { type: "loaded", title: "Regulations on Fintech", displayOptions: { frame: true, download: true, embed: true, copyright: true } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sentOfType(posted, "save")).toHaveLength(1));
    fromEditor(iframe, { type: "saved", requestId: sentOfType(posted, "save")[0].requestId, contentId: "101", title: "Regulations on Fintech", library: "H5P.InteractiveVideo 1.27" });
    expect(await screen.findByText("Your activity was saved, but its details were not. Try saving again.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateActivity).toHaveBeenCalledTimes(2));
    expect(sentOfType(posted, "save")).toHaveLength(1);
    expect(api.updateActivity.mock.calls[1][1]).toEqual(expect.objectContaining({ contentSaved: expect.objectContaining({ library: "H5P.InteractiveVideo 1.27" }) }));
  });

  it("keeps every subject of a migrated activity on save, and adds or removes them one at a time", async () => {
    const multi = editable("owner");
    multi.data.activity.subjects = ["Business", "Economics"];
    api.getActivityForEditing.mockResolvedValue(multi);
    renderAt("/h5p/AbCd1234/edit");
    const iframe = (await screen.findByTitle("H5P editor")) as HTMLIFrameElement;
    const posted = vi.spyOn(iframe.contentWindow!, "postMessage");
    fromEditor(iframe, { type: "loaded", title: "Regulations on Fintech", displayOptions: { frame: true, download: true, embed: true, copyright: true } });

    await userEvent.click(await screen.findByRole("button", { name: "Remove subject Business" }));
    await screen.findByRole("option", { name: "Biology" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Subjects/ }), "Biology");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sentOfType(posted, "save")).toHaveLength(1));
    fromEditor(iframe, { type: "saved", requestId: sentOfType(posted, "save")[0].requestId, contentId: "101", title: "Regulations on Fintech", library: "H5P.InteractiveVideo 1.27", libraryTitle: "Interactive Video" });

    await waitFor(() => expect(api.updateActivity).toHaveBeenCalled());
    expect(api.updateActivity).toHaveBeenCalledWith("AbCd1234", expect.objectContaining({
      subjects: ["Economics", "Biology"],
      contentSaved: expect.objectContaining({ libraryTitle: "Interactive Video" }),
    }));
  });

  it("explains a validation failure from the editor", async () => {
    api.getActivityForEditing.mockResolvedValue(editable("owner"));
    renderAt("/h5p/AbCd1234/edit");
    const iframe = (await screen.findByTitle("H5P editor")) as HTMLIFrameElement;
    const posted = vi.spyOn(iframe.contentWindow!, "postMessage");
    fromEditor(iframe, { type: "loaded", title: "x" });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sentOfType(posted, "save")).toHaveLength(1));
    fromEditor(iframe, { type: "save-failed", requestId: sentOfType(posted, "save")[0].requestId, reason: "validation" });
    expect(await screen.findByText(/The editor found problems with this activity/)).toBeInTheDocument();
    expect(api.updateActivity).not.toHaveBeenCalled();
  });

  it("shows one message for an activity the user cannot edit", async () => {
    api.getActivityForEditing.mockRejectedValue({ response: { status: 403 } });
    renderAt("/h5p/AbCd1234/edit");
    expect(await screen.findByText("This activity isn't available to edit")).toBeInTheDocument();
  });
});
