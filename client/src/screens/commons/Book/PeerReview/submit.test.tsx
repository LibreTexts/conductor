import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import PeerReviewSubmitPage from "./submit";

// ---- hoisted mocks (factories run before imports) ----
const mockPush = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useParams: vi.fn(() => ({ bookID: "test-book-id" })),
    useHistory: vi.fn(() => ({ push: mockPush })),
  };
});

vi.mock("../../../../api", () => ({
  default: {
    getBookDetail: vi.fn(),
    getProjectPeerReviewRubric: vi.fn(),
    submitPeerReview: vi.fn(),
  },
}));

// Avoid needing a real Redux store — provide minimal no-op implementations.
vi.mock("../../../../state/hooks", () => ({
  useTypedSelector: vi.fn(),
}));

vi.mock("../../../../components/error/ErrorHooks", () => ({
  default: () => ({
    handleGlobalError: vi.fn(),
    setError: vi.fn(),
    clearError: vi.fn(),
    error: { show: false },
  }),
}));

// ---- import after mocks are set up ----
import api from "../../../../api";
import { useTypedSelector } from "../../../../state/hooks";

// ---- test fixtures ----
const mockBook = {
  projectID: "project-123",
  title: "Introduction to Testing",
  allowAnonPR: true,
};

const mockRubric = {
  rubricTitle: "Standard Review Rubric",
  headings: [],
  textBlocks: [],
  prompts: [
    {
      _id: "prompt-text-1",
      promptType: "text",
      promptText: "What did you find most useful?",
      promptRequired: false,
      order: 1,
    },
  ],
};

const unauthUser = {
  isAuthenticated: false,
  firstName: "",
  lastName: "",
  uuid: "",
  email: "",
};

const authUser = {
  isAuthenticated: true,
  firstName: "Jane",
  lastName: "Doe",
  uuid: "user-abc",
  email: "jane@example.com",
};

// ---- helpers ----
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <PeerReviewSubmitPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ---- tests ----
describe("PeerReviewSubmitPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default to unauthenticated.
    vi.mocked(useTypedSelector).mockImplementation((selector: (s: any) => any) =>
      selector({ user: unauthUser, error: { show: false } })
    );

    vi.mocked(api.getBookDetail).mockResolvedValue({
      data: { err: false, book: mockBook },
    } as any);

    vi.mocked(api.getProjectPeerReviewRubric).mockResolvedValue({
      data: { err: false, rubric: mockRubric },
    } as any);

    vi.mocked(api.submitPeerReview).mockResolvedValue({
      data: { err: false },
    } as any);
  });

  it("shows a spinner while loading and then renders the form after rubric loads", async () => {
    // Delay resolution so we can observe the loading state.
    let resolveBook!: (v: any) => void;
    vi.mocked(api.getBookDetail).mockReturnValue(
      new Promise((res) => (resolveBook = res)) as any
    );

    renderPage();

    expect(screen.getByText(/loading peer review form/i)).toBeInTheDocument();

    resolveBook({ data: { err: false, book: mockBook } });

    await waitFor(() =>
      expect(screen.queryByText(/loading peer review form/i)).not.toBeInTheDocument()
    );

    // Rubric title and the submit button should now be visible.
    expect(
      await screen.findByText(mockRubric.rubricTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit review/i })
    ).toBeInTheDocument();
  });

  it("shows validation errors when submitting empty required fields as an unauthenticated user", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("button", { name: /submit review/i });

    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/please select your author type/i)
      ).toBeInTheDocument();
      // The rating error renders as role="alert"; the label with similar text is not an alert.
      // Davis Input/Select also render error alerts, so check that at least one contains the rating error.
      const alerts = screen.getAllByRole("alert");
      expect(
        alerts.some((el) => /please rate this resource/i.test(el.textContent ?? ""))
      ).toBe(true);
    });

    expect(api.submitPeerReview).not.toHaveBeenCalled();
  });

  it("submits successfully for an authenticated user without name/email fields", async () => {
    vi.mocked(useTypedSelector).mockImplementation((selector: (s: any) => any) =>
      selector({ user: authUser, error: { show: false } })
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("button", { name: /submit review/i });

    // Authenticated users should NOT see first/last/email fields.
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/last name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();

    // Set author type (native <select>).
    await user.selectOptions(
      screen.getByRole("combobox", { name: /i am a\(n\)/i }),
      "student"
    );

    // Set star rating — both the radio input and its label share the same title,
    // so grab all matches and find the <input> element specifically.
    const threeStarRadio = screen
      .getAllByTitle("3 stars")
      .find((el) => el.tagName === "INPUT")!;
    await user.click(threeStarRadio);

    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => expect(api.submitPeerReview).toHaveBeenCalledOnce());

    const payload = vi.mocked(api.submitPeerReview).mock.calls[0][0];
    expect(payload).toMatchObject({
      projectID: "project-123",
      authorType: "student",
      rating: 3,
    });
    expect(payload).not.toHaveProperty("authorFirst");
    expect(payload).not.toHaveProperty("authorLast");
    expect(payload).not.toHaveProperty("authorEmail");

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/book/test-book-id")
    );
  });

  it("submits successfully for an unauthenticated user with name and email in the payload", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("button", { name: /submit review/i });

    // Fill identity fields shown to anonymous users.
    await user.type(screen.getByLabelText(/first name/i), "Alex");
    await user.type(screen.getByLabelText(/last name/i), "Smith");
    await user.type(screen.getByLabelText(/email/i), "alex@example.com");

    // Set author type.
    await user.selectOptions(
      screen.getByRole("combobox", { name: /i am a\(n\)/i }),
      "instructor"
    );

    // Set star rating — same dual-title issue; find the radio <input>.
    const fourStarRadio = screen
      .getAllByTitle("4 stars")
      .find((el) => el.tagName === "INPUT")!;
    await user.click(fourStarRadio);

    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => expect(api.submitPeerReview).toHaveBeenCalledOnce());

    const payload = vi.mocked(api.submitPeerReview).mock.calls[0][0];
    expect(payload).toMatchObject({
      projectID: "project-123",
      authorType: "instructor",
      rating: 4,
      authorFirst: "Alex",
      authorLast: "Smith",
      authorEmail: "alex@example.com",
    });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/book/test-book-id")
    );
  });
});
