import { createContext, useContext } from "react";
import { ClearAndCreateCart } from "../providers/CartProvider";
import { Cart } from "../types";

export interface CartContextType {
  cart: Cart | undefined;
  refreshCart: () => Promise<void>;
  productCount: number;
  numInCart: (variant_id: string) => number;
  clearAndCreateCart: ClearAndCreateCart;
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
