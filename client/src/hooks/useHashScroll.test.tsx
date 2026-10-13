import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import useHashScroll from "./useHashScroll";

const Probe = ({ ready }: { ready: boolean }) => {
  useHashScroll(ready);
  return null;
};

function renderAt(hash: string, ready = true) {
  return render(
    <MemoryRouter initialEntries={[`/insight/embedding-adapt${hash}`]}>
      <Probe ready={ready} />
    </MemoryRouter>
  );
}

let target: HTMLHeadingElement;
let scrollIntoView: Mock<Element["scrollIntoView"]>;

beforeEach(() => {
  document.body.innerHTML = "";
  target = document.createElement("h2");
  target.id = "embedding-summative-assessments";
  document.body.appendChild(target);

  scrollIntoView = vi.fn<Element["scrollIntoView"]>();
  target.scrollIntoView = scrollIntoView;

  // jsdom has no matchMedia; the hook uses it to honour reduced motion.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
});

describe("useHashScroll", () => {
  it("scrolls to the heading named by the fragment and focuses it", () => {
    renderAt("#embedding-summative-assessments");

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
    expect(target.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(target);
  });

  it("waits until the content has rendered", () => {
    const { rerender } = renderAt("#embedding-summative-assessments", false);
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter
        initialEntries={["/insight/embedding-adapt#embedding-summative-assessments"]}
      >
        <Probe ready />
      </MemoryRouter>
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does not scroll again on a re-render, so it cannot yank a reader", () => {
    const { rerender } = renderAt("#embedding-summative-assessments");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter
        initialEntries={["/insight/embedding-adapt#embedding-summative-assessments"]}
      >
        <Probe ready />
      </MemoryRouter>
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("decodes a percent-encoded fragment", () => {
    renderAt("#embedding%2Dsummative%2Dassessments");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a fragment, or for an unknown one", () => {
    renderAt("");
    renderAt("#no-such-heading");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("skips smooth scrolling under prefers-reduced-motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
    renderAt("#embedding-summative-assessments");

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "auto",
    });
  });
});
