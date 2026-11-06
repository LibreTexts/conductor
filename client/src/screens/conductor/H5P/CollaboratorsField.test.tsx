import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import CollaboratorsField, { MAX_COLLABORATORS } from "./CollaboratorsField";
import { ActivityEditorRole, ActivityPerson } from "../../../types";

const api = vi.hoisted(() => ({
  searchActivityCollaborators: vi.fn(),
  addActivityCollaborator: vi.fn(),
  removeActivityCollaborator: vi.fn(),
}));
const notify = vi.hoisted(() => vi.fn());

vi.mock("../../../api", () => ({ default: api }));
vi.mock("../../../context/NotificationContext", () => ({ useNotifications: () => ({ addNotification: notify }) }));

const OWNER: ActivityPerson = { uuid: "o", name: "Sophie K", role: "owner" };
const COLLAB: ActivityPerson = { uuid: "c", name: "Jake Turner", role: "collaborator" };

let location: { pathname: string } = { pathname: "" };
function renderField({
  role,
  people = [OWNER, COLLAB],
  me = "o",
  create = false,
}: { role: ActivityEditorRole; people?: ActivityPerson[]; me?: string; create?: boolean }) {
  const activityID = create ? undefined : "101";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["activity-authoring", activityID], { role, people });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/h5p/101/edit"]}>
          <CollaboratorsField activityID={activityID} people={people} role={role} currentUserUUID={me} />
          <Route path="*" render={({ location: l }) => { location = l; return null; }} />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  notify.mockReset();
  api.searchActivityCollaborators.mockResolvedValue({
    data: { err: false, users: [{ uuid: "n", firstName: "Nia", lastName: "Long", emailDomain: "college.edu" }] },
  });
});

describe("CollaboratorsField", () => {
  it("lets the owner add someone found by name", async () => {
    api.addActivityCollaborator.mockResolvedValue({
      data: { err: false, people: [OWNER, COLLAB, { uuid: "n", name: "Nia Long", role: "collaborator" }] },
    });
    const { client } = renderField({ role: "owner" });
    await userEvent.type(screen.getByRole("combobox", { name: "Add a collaborator" }), "Nia");
    await userEvent.click(await screen.findByRole("option", { name: /Nia Long/ }));
    await waitFor(() => expect(api.addActivityCollaborator).toHaveBeenCalledWith("101", "n"));
    await waitFor(() =>
      expect((client.getQueryData(["activity-authoring", "101"]) as any).people).toHaveLength(3)
    );
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "success", message: "Added Nia Long as a collaborator." }));
  });

  it("lets the owner remove a collaborator but never the owner", async () => {
    api.removeActivityCollaborator.mockResolvedValue({ data: { err: false, people: [OWNER] } });
    renderField({ role: "owner" });
    expect(screen.queryByRole("button", { name: "Remove Sophie K" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Remove Jake Turner" }));
    await waitFor(() => expect(api.removeActivityCollaborator).toHaveBeenCalledWith("101", "c"));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Removed Jake Turner." }));
  });

  it("gives staff the same controls as the owner", () => {
    renderField({ role: "staff", me: "s" });
    expect(screen.getByRole("combobox", { name: "Add a collaborator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Jake Turner" })).toBeInTheDocument();
  });

  it("offers a collaborator only Leave, on their own row", () => {
    renderField({ role: "collaborator", me: "c" });
    expect(screen.queryByRole("combobox", { name: "Add a collaborator" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
    expect(api.searchActivityCollaborators).not.toHaveBeenCalled();
  });

  it("asks before leaving, then returns to My H5P", async () => {
    api.removeActivityCollaborator.mockResolvedValue({ data: { err: false, people: [OWNER], left: true } });
    renderField({ role: "collaborator", me: "c" });
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(await screen.findByText("Leave this activity?")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Leave" }).at(-1)!);
    await waitFor(() => expect(api.removeActivityCollaborator).toHaveBeenCalledWith("101", "c"));
    await waitFor(() => expect(location.pathname).toBe("/h5p"));
  });

  it("stops offering the search once the activity has the most collaborators allowed", () => {
    const many = Array.from({ length: MAX_COLLABORATORS }, (_, i) => ({
      uuid: `c${i}`, name: `Person ${i}`, role: "collaborator" as const,
    }));
    renderField({ role: "owner", people: [OWNER, ...many] });
    expect(screen.queryByRole("combobox", { name: "Add a collaborator" })).toBeNull();
    expect(screen.getByText(/up to 10 collaborators/)).toBeInTheDocument();
  });

  it("shows the server's reason when an add is refused", async () => {
    api.addActivityCollaborator.mockRejectedValue({
      response: { status: 400, data: { err: true, errMsg: "Sorry, an H5P activity can have at most 10 collaborators." } },
    });
    renderField({ role: "owner" });
    await userEvent.type(screen.getByRole("combobox", { name: "Add a collaborator" }), "Nia");
    await userEvent.click(await screen.findByRole("option", { name: /Nia Long/ }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", message: "Sorry, an H5P activity can have at most 10 collaborators." })
      )
    );
  });

  it("offers no management while an activity is being created", () => {
    renderField({ role: "owner", people: [], create: true });
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Add a collaborator" })).toBeNull();
  });
});
