import { describe, expect, it } from "vitest";
import { CartItem, StoreCartReconciliation, StoreProduct, StoreProductPrice } from "../types";
import { applyCartReconciliation, buildCartNotice, formatCartNotice } from "./storeHelpers";

const price = (id: string, unit_amount: number, nickname = "Hardcover, Color") =>
  ({ id, unit_amount, nickname }) as StoreProductPrice;

const product = (id: string, name = "Calculus") =>
  ({ id, name, prices: [] }) as unknown as StoreProduct;

const line = (
  id: string,
  productId: string,
  linePrice: StoreProductPrice,
  quantity = 1
): CartItem => ({ id, product: product(productId), price: linePrice, quantity });

const swap = (
  productId: string,
  oldPriceId: string,
  newPrice: StoreProductPrice,
  newProduct = product(productId)
): StoreCartReconciliation["updated"][number] => ({
  product_id: productId,
  old_price_id: oldPriceId,
  product: newProduct,
  price: newPrice,
});

describe("applyCartReconciliation", () => {
  it("replaces the product and price on a stale line and keeps its id and quantity", () => {
    const newProduct = product("prod_a", "Calculus, 2nd Edition");
    const newPrice = price("price_new", 1400);

    const result = applyCartReconciliation(
      [line("line_1", "prod_a", price("price_old", 1250), 3)],
      { updated: [swap("prod_a", "price_old", newPrice, newProduct)], removed: [] }
    );

    expect(result).toEqual([
      { id: "line_1", product: newProduct, price: newPrice, quantity: 3 },
    ]);
  });

  it("drops removed lines and leaves other variants of the same product alone", () => {
    const paperback = line("line_2", "prod_a", price("price_paperback", 900));

    const result = applyCartReconciliation(
      [line("line_1", "prod_a", price("price_hardcover", 1250)), paperback],
      { updated: [], removed: [{ product_id: "prod_a", price_id: "price_hardcover" }] }
    );

    expect(result).toEqual([paperback]);
  });

  it("merges a stale line into the line already on the replacement price", () => {
    const newPrice = price("price_new", 1400);

    const result = applyCartReconciliation(
      [
        line("line_1", "prod_a", newPrice, 2),
        line("line_2", "prod_a", price("price_old", 1250), 3),
      ],
      { updated: [swap("prod_a", "price_old", newPrice)], removed: [] }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "line_1", quantity: 5 });
    expect(result[0].price).toEqual(newPrice);
  });

  it("keeps the server's product and price whichever merged line comes first", () => {
    const freshProduct = product("prod_a", "Calculus, 2nd Edition");
    const freshPrice = price("price_new", 1400, "Hardcover, Color (updated)");
    const reconciliation = {
      updated: [swap("prod_a", "price_old", freshPrice, freshProduct)],
      removed: [],
    };
    const cachedNew = line("line_1", "prod_a", price("price_new", 1400), 2);
    const stale = line("line_2", "prod_a", price("price_old", 1250), 3);

    for (const order of [[cachedNew, stale], [stale, cachedNew]]) {
      const result = applyCartReconciliation(order, reconciliation);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ quantity: 5, product: freshProduct, price: freshPrice });
    }
  });

  it("does not touch a matching price id under a different product", () => {
    const other = line("line_1", "prod_b", price("price_old", 1250));

    const result = applyCartReconciliation([other], {
      updated: [swap("prod_a", "price_old", price("price_new", 1400))],
      removed: [{ product_id: "prod_a", price_id: "price_old" }],
    });

    expect(result).toEqual([other]);
  });
});

describe("formatCartNotice", () => {
  it("puts the review prompt first, then one line per change", () => {
    const message = formatCartNotice({
      changed: [{ label: "Calculus - Hardcover, Color", old_amount: 1250, new_amount: 1400 }],
      removed: ["Physics - Paperback, Black & White"],
    });

    expect(message.split("\n")).toEqual([
      "We updated your cart with the latest product data. Please review your pricing before continuing.",
      "Calculus - Hardcover, Color: $12.50 to $14.00",
      "No longer available and removed from your cart: Physics - Paperback, Black & White",
    ]);
  });
});

describe("buildCartNotice", () => {
  it("reports old and new amounts for a price change", () => {
    const notice = buildCartNotice(
      [line("line_1", "prod_a", price("price_old", 1250))],
      { updated: [swap("prod_a", "price_old", price("price_new", 1400))], removed: [] }
    );

    expect(notice).toEqual({
      changed: [
        { label: "Calculus - Hardcover, Color", old_amount: 1250, new_amount: 1400 },
      ],
      removed: [],
    });
  });

  it("names removed lines using the cart's product data", () => {
    const notice = buildCartNotice(
      [line("line_1", "prod_a", price("price_old", 1250))],
      { updated: [], removed: [{ product_id: "prod_a", price_id: "price_old" }] }
    );

    expect(notice).toEqual({ changed: [], removed: ["Calculus - Hardcover, Color"] });
  });

  it("returns null when a replacement price has the same amount", () => {
    const notice = buildCartNotice(
      [line("line_1", "prod_a", price("price_old", 1250))],
      { updated: [swap("prod_a", "price_old", price("price_new", 1250))], removed: [] }
    );

    expect(notice).toBeNull();
  });

  it("returns null when nothing changed", () => {
    const notice = buildCartNotice(
      [line("line_1", "prod_a", price("price_old", 1250))],
      { updated: [], removed: [] }
    );

    expect(notice).toBeNull();
  });
});
