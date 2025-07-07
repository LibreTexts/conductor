import { CartContext } from "../context/CartContext";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StoreProduct, StoreProductPrice, Cart } from "../types";

const CART_STORAGE_KEY = "libretexts_store_cart";

const getCartFromStorage = (): Cart | null => {
  const cartData = localStorage.getItem(CART_STORAGE_KEY);
  if (!cartData) return null;
  try {
    return JSON.parse(cartData);
  } catch (error) {
    console.error("Failed to parse cart from storage", error);
    return null;
  }
};

const saveCartToStorage = (cart: Cart) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error("Error saving cart to localStorage:", error);
  }
};

const calculateSubtotal = (items: Cart["items"]): number => {
  return items.reduce((total, item) => {
    if (!item.price || !item.price.unit_amount || item.quantity <= 0) {
      return total;
    }
    const itemTotal = item.price.unit_amount * item.quantity;
    return total + itemTotal;
  }, 0);
};

const EMPTY_CART: Cart = {
  id: crypto.randomUUID(),
  items: [],
  subtotal: 0,
};

const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedCart = getCartFromStorage();
    if (storedCart) {
      setCart(storedCart);
    }
    setLoading(false);
  }, []);

  // Save cart on change
  useEffect(() => {
    if (cart) {
      saveCartToStorage(cart);
    } else {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [cart]);

  const refreshCart = async () => {
    setLoading(true);
    const stored = getCartFromStorage();
    if (stored) {
      setCart(stored);
    } else {
      setCart(null);
    }
    setLoading(false);
  };

  const clearAndCreateCart = useCallback(() => {
    setLoading(true);
    setCart(EMPTY_CART);
    saveCartToStorage(EMPTY_CART);
    setLoading(false);
  }, []);

  const addToCart = useCallback(
    (
      product: StoreProduct,
      price: StoreProductPrice,
      quantity: number = 1
    ) => {
      setCart((prevCart) => {
        const currentCart = prevCart || EMPTY_CART;
        const existingItemIndex = currentCart.items.findIndex(
          (item) => item.product.id === product.id && item.price.id === price.id
        );

        if (existingItemIndex >= 0) {
          const updatedItems = [...currentCart.items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            price: price, // always update price (only one price can be selected for a product)
            quantity: updatedItems[existingItemIndex].quantity + quantity,
          };

          const updatedSubtotal = calculateSubtotal(updatedItems);
          return {
            ...currentCart,
            items: updatedItems,
            subtotal: updatedSubtotal,
          };
        }

        const withNewItem = [
          ...currentCart.items,
          {
            id: crypto.randomUUID(),
            product,
            price,
            quantity,
          },
        ];

        const updatedSubtotal = calculateSubtotal(withNewItem);

        return {
          ...currentCart,
          items: withNewItem,
          subtotal: updatedSubtotal,
        };
      });
    },
    []
  );

  const removeFromCart = useCallback((productId: string, priceId: string) => {
    setCart((prevCart) => {
      if (!prevCart) return prevCart;

      const updatedItems = prevCart.items.filter((item) => {
        if (item.product.id !== productId || item.price.id !== priceId) {
          return true;
        }
        return false;
      });

      const updatedSubtotal = calculateSubtotal(updatedItems);
      return {
        ...prevCart,
        items: updatedItems,
        subtotal: updatedSubtotal,
      };
    });
  }, []);

  const updateQuantity = useCallback(
    (productId: string, priceId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId, priceId);
        return;
      }

      setCart((prevCart) => {
        if (!prevCart) return prevCart;
        const updatedItems = prevCart.items.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        );
        const updatedSubtotal = calculateSubtotal(updatedItems);
        return { ...prevCart, items: updatedItems, subtotal: updatedSubtotal };
      });
    },
    [removeFromCart]
  );

  const productCount = useMemo(() => {
    if (!cart || !cart.items) return 0;
    return cart.items.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const numInCart = useCallback(
    (productId: string): number => {
      if (!cart || !cart.items) return 0;
      const found = cart.items.find((item) => item.product.id === productId);
      return found ? found.quantity : 0;
    },
    [cart]
  );

  const hasDigitalProducts = useMemo(() => {
    if (!cart || !cart.items) return false;
    return cart.items.some((item) => item.product.metadata?.digital === "true");
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart: cart || undefined,
        refreshCart,
        productCount,
        numInCart,
        hasDigitalProducts,
        clearAndCreateCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartProvider;
