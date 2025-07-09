import { StoreProduct, StoreProductPrice } from "../types";

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
