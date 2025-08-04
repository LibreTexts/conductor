import { createContext, useContext } from "react";
import { StoreProduct, StoreProductPrice, Cart } from "../types";

export interface CartContextType {
  cart: Cart | undefined;
  refreshCart: () => Promise<void>;
  productCount: number;
  numInCart: (productId: string) => number;
  hasDigitalProducts: boolean;
  hasPhysicalProducts: boolean;
  clearAndCreateCart: () => void;
  addToCart: (product: StoreProduct, price: StoreProductPrice, quantity: number) => void;
  removeFromCart: (productId: string, priceId: string) => void;
  updateQuantity: (productId: string, priceId: string, quantity: number) => void;
  loading: boolean;
}

export const CartContext = createContext<CartContextType | undefined>(
  undefined
);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
