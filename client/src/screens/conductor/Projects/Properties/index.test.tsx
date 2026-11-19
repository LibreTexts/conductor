import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ProjectProperties from "./index";

const api = vi.hoisted(() => ({
  getProject: vi.fn(),
  getTags: vi.fn(),
  getCIDDescriptors: vi.fn(),
  getCentralIdentityLicenses: vi.fn(),
  getCampusDefaultFramework: vi.fn(),
  getCentralIdentityADAPTOrgs: vi.fn(),
  getAuthors: vi.fn(),
  uploadProjectThumbnail: vi.fn(),
}));
const put = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => vi.fn());
const globalError = vi.hoisted(() => vi.fn());

vi.mock("../../../../api", () => ({ default: api }));
vi.mock("axios", () => ({ default: { put } }));
vi.mock("../../../../context/NotificationContext", () => ({ useNotifications: () => ({ addNotification: notify }) }));
vi.mock("../../../../context/ModalContext", () => ({
  useModals: () => ({ openModal: vi.fn(), closeModal: vi.fn(), closeAllModals: vi.fn() }),
}));
vi.mock("../../../../components/error/ErrorHooks", () => ({
  default: () => ({ handleGlobalError: globalError }),
}));
vi.mock("../../../../state/hooks", () => ({
  useTypedSelector: (select: (state: any) => unknown) =>
    select({ user: { uuid: "member-1", isSuperAdmin: false }, org: { orgID: "libretexts" } }),
}));

const emptyLicense = { name: "", version: "", url: "", sourceURL: "", modifiedFromSource: false, additionalTerms: "" };

const baseProject = {
  orgID: "libretexts",
  projectID: "P1",
  title: "Biology 101",
  status: "open",
  visibility: "private",
  classification: "harvesting",
  leads: [] as { uuid: string }[],
  liaisons: [],
  members: [{ uuid: "member-1" }],
  auditors: [],
  tags: [],
  cidDescriptors: [],
  associatedOrgs: [],
  license: emptyLicense,
  defaultFileLicense: emptyLicense,
};

let location = { pathname: "" };
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/projects/P1/properties"]}>
        <Route exact path="/projects/:id/properties" component={ProjectProperties} />
        <Route path="*" render={({ location: l }) => { location = l; return null; }} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  put.mockReset();
  notify.mockReset();
  globalError.mockReset();
  api.getProject.mockResolvedValue({ data: { project: baseProject } });
  api.getTags.mockResolvedValue({ data: { tags: [{ title: "Biology" }] } });
  api.getCIDDescriptors.mockResolvedValue({ data: { descriptors: [] } });
  api.getCentralIdentityLicenses.mockResolvedValue({
    data: { licenses: [{ name: "CC BY", versions: ["3.0", "4.0"], url: "https://cc.example/by" }] },
  });
  api.getCampusDefaultFramework.mockResolvedValue({ data: { framework: null } });
  api.getCentralIdentityADAPTOrgs.mockResolvedValue({ data: { orgs: [] } });
  api.getAuthors.mockResolvedValue({ data: { items: [] } });
  put.mockResolvedValue({ data: { err: false } });
});

describe("Project Properties page", () => {
  it("loads the project into the form and saves an edited title", async () => {
    const user = userEvent.setup();
    renderPage();

    const title = await screen.findByLabelText(/Project Title/);
    expect(title).toHaveValue("Biology 101");

    await user.clear(title);
    await user.type(title, "Biology 102");
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Save Changes/ }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith("/project", expect.objectContaining({ projectID: "P1", title: "Biology 102" }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }))
    );
    expect(screen.queryByText("You have unsaved changes.")).not.toBeInTheDocument();
  });

  it("sends people who are not on the team back to the project", async () => {
    api.getProject.mockResolvedValue({ data: { project: { ...baseProject, members: [] } } });
    renderPage();
    await waitFor(() => expect(location.pathname).toBe("/projects/P1"));
  });

  it("shows the Danger Zone to project admins only", async () => {
    const { unmount } = renderPage();
    await screen.findByLabelText(/Project Title/);
    expect(screen.queryByRole("button", { name: /Delete Project/ })).not.toBeInTheDocument();
    unmount();

    api.getProject.mockResolvedValue({ data: { project: { ...baseProject, leads: [{ uuid: "member-1" }] } } });
    renderPage();
    expect(await screen.findByRole("button", { name: /Delete Project/ })).toBeInTheDocument();
  });

  it("requires a license version when the chosen license has versions", async () => {
    api.getProject.mockResolvedValue({
      data: { project: { ...baseProject, license: { ...emptyLicense, name: "CC BY" } } },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByLabelText(/Project Title/);
    await screen.findAllByRole("combobox", { name: /^Version/ });
    await user.click(screen.getByRole("button", { name: /Save Changes/ }));

    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});
