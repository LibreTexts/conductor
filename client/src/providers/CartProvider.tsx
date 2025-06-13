import { CartContext } from "../context/CartContext";
import React, { useCallback, useMemo } from "react";
import {
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { Cart } from "../types";

export type ClearAndCreateCart = UseMutationResult<
  void,
  unknown,
  void,
  unknown
>;

const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const {
    data: cart,
    isLoading,
    refetch,
  } = useQuery<Cart | null>({
    queryKey: ["cart"],
    queryFn: async () => {
      const cartRes = await axios.get<Cart | null>("/api/cart");
      return cartRes.data;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const refreshCart = async () => {
    await refetch();
  };

  const clearAndCreateCart = useMutation({
    mutationFn: async () => {
      await axios.post("/api/cart/clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cart"],
      });
    },
  });

  const productCount = useMemo(() => {
    if (!cart || !cart.items) return 0;
    return cart?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;
  }, [cart]);

  const numInCart = useCallback(
    (variantId: string): number => {
      if (!cart || !cart.items) return 0;
      const found = cart.items.find((item) => item.variant_id === variantId);
      return found ? found.quantity : 0;
    },
    [cart]
  );

  return (
    <CartContext.Provider
      value={{
        cart: cart || undefined,
        refreshCart,
        productCount,
        numInCart,
        clearAndCreateCart,
        loading: isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartProvider;
