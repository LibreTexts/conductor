export type OrderProduct = {
  id: string;
  price: {
    id: string;
    unit_amount: number;
    currency: string;
    product: {
      id: string;
      name: string;
      description?: string;
      images?: string[];
      metadata?: {
        digital?: string;
      };
    };
  };
  quantity: number;
  amount_total: number;
};

export type OrderCustomerAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export type OrderCustomer = {
  name?: string;
  email?: string;
  phone?: string;
  address?: OrderCustomerAddress;
};

export type OrderChargeCardDetails = {
  brand?: string;
  country?: string;
  exp_month?: number;
  exp_year?: number;
  last4?: string;
};

export type OrderCharge = {
  id: string;
  payment_intent: string;
  payment_method_details: {
    card?: OrderChargeCardDetails;
    type: string;
  };
};

export type OrderSession = {
  id: string;
  created: number;
  amount_subtotal: number;
  amount_total: number;
  total_details: {
    amount_discount: number;
    amount_shipping: number;
    amount_tax: number;
  };
  line_items: {
    data: OrderProduct[];
  };
  customer_details?: OrderCustomer;
};

export type GetOrderResponse = {
  session: OrderSession;
  charge?: OrderCharge;
};