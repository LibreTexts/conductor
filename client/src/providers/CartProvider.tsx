import { CartContext } from "../context/CartContext";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { StoreProduct, StoreProductPrice, Cart } from "../types";
import { useNotifications } from "../context/NotificationContext";

const CART_STORAGE_KEY = "libretexts_store_cart";
const CART_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

const createEmptyCart = (): Cart => ({
  id: crypto.randomUUID(),
  items: [],
  subtotal: 0,
  cart_first_created: new Date().toISOString(), // UTC
});

const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const { addNotification } = useNotifications();
  const freshnessCheckedRef = useRef(false);

  useEffect(() => {
    const storedCart = getCartFromStorage();
    if (storedCart) {
      setCart(storedCart);
    }
    setLoading(false);
  }, []);

  // On entering any /store/* route, discard carts that are missing a creation
  // timestamp or older than 7 days so visitors never act on stale data.
  useEffect(() => {
    if (!location.pathname.startsWith("/store")) {
      freshnessCheckedRef.current = false; // re-arm for next store visit
      return;
    }
    if (freshnessCheckedRef.current) return; // once per store session
    freshnessCheckedRef.current = true;

    const stored = getCartFromStorage();
    if (!stored) return; // no cart to check

    const created = stored.cart_first_created
      ? Date.parse(stored.cart_first_created)
      : NaN;
    const now = Date.now();
    const isFresh =
      Number.isFinite(created) && created <= now && now - created < CART_MAX_AGE_MS;

    if (!isFresh) {
      localStorage.removeItem(CART_STORAGE_KEY);
      setCart(null);
      addNotification({
        type: "info",
        message:
          "We cleared your cart to ensure you have the most up-to-date information",
      });
    }
  }, [location.pathname, addNotification]);

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

  // Fully removes the cart from storage. The [cart] effect calls
  // localStorage.removeItem when cart is null, so the storage key (and its
  // cart_first_created timestamp) is deleted rather than reused.
  const clearCart = useCallback(() => setCart(null), []);

  const addToCart = useCallback(
    (
      product: StoreProduct,
      price: StoreProductPrice,
      quantity: number = 1
    ) => {
      setCart((prevCart) => {
        const currentCart = prevCart || createEmptyCart();
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

  const hasPhysicalProducts = useMemo(() => {
    if (!cart || !cart.items) return false;
    return cart.items.some((item) => item.product.metadata?.digital !== "true");
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart: cart || undefined,
        refreshCart,
        productCount,
        numInCart,
        hasDigitalProducts,
        hasPhysicalProducts,
        clearCart,
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
