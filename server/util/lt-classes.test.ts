import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isQuotedClass, parseLtClass, parseLtClasses, quotationRate } from "./lt-classes.js";

const own = { lib: "dev", pageID: 1000 };

describe("parseLtClass", () => {
  it("reads known libraries only", () => {
    assert.deepEqual(parseLtClass("lt-chem-2000"), { lib: "chem", pageID: 2000 });
    assert.equal(parseLtClass("lt-foo-1"), null);
    assert.equal(parseLtClass("lt-chem-abc"), null);
    assert.equal(parseLtClass("editable"), null);
  });
});

describe("parseLtClasses", () => {
  it("lists each other page once, with its block count, in document order", () => {
    const html =
      '<p class="lt-chem-3000">a</p><p class="lt-chem-2000 editable">b</p><h2 class="lt-chem-2000">c</h2>';
    assert.deepEqual(parseLtClasses(html, { own }), [
      { lib: "chem", pageID: 3000, blocks: 1 },
      { lib: "chem", pageID: 2000, blocks: 2 },
    ]);
  });

  it("never counts the page's own class", () => {
    assert.deepEqual(parseLtClasses('<p class="lt-dev-1000">mine</p>', { own }), []);
  });

  it("ignores class names mentioned in text and unknown libraries", () => {
    assert.deepEqual(parseLtClasses('<p>see lt-chem-2000</p><p class="lt-foo-9">x</p>', { own }), []);
  });

  it("unwraps the contents API's JSON envelope", () => {
    const raw = JSON.stringify({ body: '<p class="lt-math-2479">copied</p>' });
    assert.deepEqual(parseLtClasses(raw, { own }), [{ lib: "math", pageID: 2479, blocks: 1 }]);
  });
});

describe("isQuotedClass", () => {
  it("is true only for another page's class", () => {
    assert.equal(isQuotedClass("lt-dev-1000 editable", own), false);
    assert.equal(isQuotedClass("lt-chem-2000", own), true);
    assert.equal(isQuotedClass(undefined, own), false);
  });
});

describe("quotationRate", () => {
  it("is 0 when every block carries the page's own class", () => {
    assert.equal(quotationRate('<p class="lt-dev-1000">a</p><h2 class="lt-dev-1000">b</h2>', own), 0);
  });

  it("is the share of blocks from other pages", () => {
    const html =
      '<p class="lt-dev-1000">a</p><p class="lt-math-2479">b</p><p>c</p><p>d</p>';
    assert.equal(quotationRate(html, own), 0.25);
  });

  it("counts unclassed blocks as the page's own", () => {
    assert.equal(quotationRate('<p>a</p><p>b</p><p>c</p><p class="lt-chem-2000">d</p>', own), 0.25);
  });

  it("is 1 when every block is another page's", () => {
    assert.equal(quotationRate('<p class="lt-chem-2000">a</p><p class="lt-chem-2000">b</p>', own), 1);
  });

  it("is 0 for a page without text blocks", () => {
    assert.equal(quotationRate("<div><img src='x'></div>", own), 0);
  });
});
