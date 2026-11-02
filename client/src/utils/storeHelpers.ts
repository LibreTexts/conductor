import {
    CartItem,
    StoreCartNotice,
    StoreCartReconciliation,
    StoreProduct,
    StoreProductPrice,
} from "../types";

/**
 * Max quantity constants
 * Mirrored and validated in `server/api/services/store-service.ts`
 * but defined here for better UX in the frontend when setting max values on quantity selectors and providing user feedback.
 * See `client\src\hooks\useStoreMaxQuantityPerItem.ts` for reusable hook that determines max quantity based on user role.
 */
export const DEFAULT_MAX_QUANTITY = 200; // General max quantity
export const STAFF_MAX_QUANTITY = 500; // Max quantity for staff users

export const formatPrice = (price?: number | null, cents = false): string => {
    if (!price || isNaN(price)) {
        return "Unknown";
    }

    if (cents) {
        return `$${(price / 100).toFixed(2)}`;
    }
    return `$${price.toFixed(2)}`;
}
export const findBookPrice = ({ product, hardcover, color }: {
    product: StoreProduct,
    hardcover?: boolean,
    color?: boolean
}): StoreProductPrice | undefined => {
    if (!product || !product.prices || product.prices.length === 0) {
        return undefined;
    }

    return product.prices.find((p) => {
        return p.metadata["hardcover"] === (hardcover ? "true" : "false") &&
            p.metadata["color"] === (color ? "true" : "false");
    })
}

/**
 * Applies a server reconciliation to cart items. Stale lines take the new product and price,
 * unavailable lines are dropped, and lines that land on the same price merge into the first.
 * Any line for a reconciled product or price takes the server's copy, so the result does not
 * depend on whether the stale line comes before or after the line it merges into.
 */
export const applyCartReconciliation = (
    items: CartItem[],
    { updated, removed }: StoreCartReconciliation
): CartItem[] => {
    const freshProducts = new Map(updated.map((u) => [u.product_id, u.product]));
    const freshPrices = new Map(
        updated.map((u) => [`${u.product_id}:${u.price.id}`, u.price])
    );
    const reconciled: CartItem[] = [];

    for (const item of items) {
        const isRemoved = removed.some(
            (r) => r.product_id === item.product.id && r.price_id === item.price.id
        );
        if (isRemoved) continue;

        const update = updated.find(
            (u) => u.product_id === item.product.id && u.old_price_id === item.price.id
        );
        const price = update?.price ?? item.price;
        const next: CartItem = {
            ...item,
            product: freshProducts.get(item.product.id) ?? item.product,
            price: freshPrices.get(`${item.product.id}:${price.id}`) ?? price,
        };

        const existingIndex = reconciled.findIndex(
            (r) => r.product.id === next.product.id && r.price.id === next.price.id
        );
        if (existingIndex >= 0) {
            const existing = reconciled[existingIndex];
            reconciled[existingIndex] = {
                ...existing,
                quantity: existing.quantity + next.quantity,
            };
        } else {
            reconciled.push(next);
        }
    }

    return reconciled;
}

/**
 * Describes a reconciliation for the customer. Returns null when nothing they would notice
 * changed, such as a replacement price at the same amount.
 */
export const buildCartNotice = (
    items: CartItem[],
    { updated, removed }: StoreCartReconciliation
): StoreCartNotice | null => {
    const changed: StoreCartNotice["changed"] = [];
    for (const update of updated) {
        const item = items.find(
            (i) => i.product.id === update.product_id && i.price.id === update.old_price_id
        );
        if (!item || item.price.unit_amount === update.price.unit_amount) continue;

        changed.push({
            label: `${update.product.name} - ${update.price.nickname}`,
            old_amount: item.price.unit_amount,
            new_amount: update.price.unit_amount,
        });
    }

    const removedLabels = removed.flatMap(({ product_id, price_id }) => {
        const item = items.find(
            (i) => i.product.id === product_id && i.price.id === price_id
        );
        return item ? [`${item.product.name} - ${item.price.nickname}`] : [];
    });

    if (changed.length === 0 && removedLabels.length === 0) return null;
    return { changed, removed: removedLabels };
}

/**
 * Plain text for the cart notice, one entry per line. The Davis Alert only takes a string message.
 */
export const formatCartNotice = ({ changed, removed }: StoreCartNotice): string => {
    return [
        "We updated your cart with the latest product data. Please review your pricing before continuing.",
        ...changed.map(({ label, old_amount, new_amount }) =>
            `${label}: ${formatPrice(old_amount, true)} to ${formatPrice(new_amount, true)}`
        ),
        ...removed.map((label) => `No longer available and removed from your cart: ${label}`),
    ].join("\n");
}

export const truncateOrderId = (orderId: string): string => {
    if(!orderId || !orderId.startsWith("cs_")) {
        return orderId;
    }
    const firstPart = orderId.slice(0, 12);
    const secondPart = orderId.slice(-12);
    return `${firstPart}...${secondPart}`;
}