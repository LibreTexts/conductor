import { Component, Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import lazyWithRetry from "./lazyWithRetry";

const Loaded = () => <div>loaded</div>;

const reload = vi.fn();

class Boundary extends Component<
  { children: any; onError?: (e: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? <div>boom</div> : this.props.children;
  }
}

describe("lazyWithRetry", () => {
  beforeEach(() => {
    reload.mockClear();
    window.sessionStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  it("renders the component when the import succeeds", async () => {
    const importer = vi.fn().mockResolvedValue({ default: Loaded });
    const Lazy = lazyWithRetry(importer as any);

    render(
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>
    );

    await waitFor(() => expect(screen.getByText("loaded")).toBeInTheDocument());
    expect(importer).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("retries once and renders when the first import fails, without reloading", async () => {
    const importer = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Failed to fetch dynamically imported module")
      )
      .mockResolvedValue({ default: Loaded });
    const Lazy = lazyWithRetry(importer as any);

    render(
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>
    );

    await waitFor(() => expect(screen.getByText("loaded")).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(importer).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when the retry also fails on a chunk error", async () => {
    const err = new Error("Failed to fetch dynamically imported module");
    const importer = vi.fn().mockRejectedValue(err);
    const Lazy = lazyWithRetry(importer as any);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let caught: unknown;

    render(
      <Boundary onError={(e) => (caught = e)}>
        <Suspense fallback={<div>loading</div>}>
          <Lazy />
        </Suspense>
      </Boundary>
    );

    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(importer).toHaveBeenCalledTimes(2);
    expect(caught).toBe(err);
    expect(reload).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("does not reload when the failure is an application error", async () => {
    const err = new Error("boom from module evaluation");
    const importer = vi.fn().mockRejectedValue(err);
    const Lazy = lazyWithRetry(importer as any);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let caught: unknown;

    render(
      <Boundary onError={(e) => (caught = e)}>
        <Suspense fallback={<div>loading</div>}>
          <Lazy />
        </Suspense>
      </Boundary>
    );

    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(importer).toHaveBeenCalledTimes(2);
    expect(caught).toBe(err);
    expect(reload).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
