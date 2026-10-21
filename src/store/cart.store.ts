import { useState, useEffect } from 'react';
import { PaymentMethod } from '../types';

export interface CartItem {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_label: string;
  unit_label: string;
  unit_price_minor: number;
  unit_cost_minor: number | null;
  quantity: number;
  max_available_stock: number;
}

export interface CartState {
  items: CartItem[];
  discountMinor: number;
  paymentMethod: PaymentMethod;
  cashReceivedMinor: number | null;
}

class CartStore {
  private state: CartState = {
    items: [],
    discountMinor: 0,
    paymentMethod: 'CASH',
    cashReceivedMinor: null,
  };

  private listeners = new Set<(state: CartState) => void>();

  getState(): CartState {
    return this.state;
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: (state: CartState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
    const existingIndex = this.state.items.findIndex((i) => i.variant_id === item.variant_id);
    let newItems: CartItem[];

    if (existingIndex >= 0) {
      newItems = [...this.state.items];
      const existing = newItems[existingIndex];
      const newQty = Math.min(existing.quantity + quantity, item.max_available_stock);
      newItems[existingIndex] = { ...existing, quantity: newQty };
    } else {
      const initialQty = Math.min(quantity, item.max_available_stock);
      newItems = [...this.state.items, { ...item, quantity: initialQty }];
    }

    this.state = { ...this.state, items: newItems };
    this.notify();
  }

  updateQuantity(variantId: string, quantity: number) {
    if (quantity <= 0) {
      this.removeItem(variantId);
      return;
    }

    const newItems = this.state.items.map((item) => {
      if (item.variant_id === variantId) {
        const validQty = Math.min(quantity, item.max_available_stock);
        return { ...item, quantity: validQty };
      }
      return item;
    });

    this.state = { ...this.state, items: newItems };
    this.notify();
  }

  removeItem(variantId: string) {
    this.state = {
      ...this.state,
      items: this.state.items.filter((i) => i.variant_id !== variantId),
    };
    this.notify();
  }

  setDiscount(discountMinor: number) {
    this.state = {
      ...this.state,
      discountMinor: Math.max(0, discountMinor),
    };
    this.notify();
  }

  setPaymentMethod(paymentMethod: PaymentMethod) {
    this.state = { ...this.state, paymentMethod };
    this.notify();
  }

  setCashReceived(cashReceivedMinor: number | null) {
    this.state = { ...this.state, cashReceivedMinor };
    this.notify();
  }

  clear() {
    this.state = {
      items: [],
      discountMinor: 0,
      paymentMethod: 'CASH',
      cashReceivedMinor: null,
    };
    this.notify();
  }

  getCalculations() {
    const subtotalMinor = this.state.items.reduce(
      (sum, item) => sum + item.unit_price_minor * item.quantity,
      0
    );
    const discountMinor = Math.min(this.state.discountMinor, subtotalMinor);
    const totalMinor = Math.max(0, subtotalMinor - discountMinor);
    const totalQuantity = this.state.items.reduce((sum, item) => sum + item.quantity, 0);

    const changeMinor =
      this.state.cashReceivedMinor !== null && this.state.cashReceivedMinor >= totalMinor
        ? this.state.cashReceivedMinor - totalMinor
        : 0;

    return {
      subtotalMinor,
      discountMinor,
      totalMinor,
      totalQuantity,
      changeMinor,
    };
  }
}

export const cartStore = new CartStore();

export function useCart() {
  const [state, setState] = useState(cartStore.getState());

  useEffect(() => {
    return cartStore.subscribe(setState);
  }, []);

  const calculations = cartStore.getCalculations();

  return {
    ...state,
    ...calculations,
    addItem: cartStore.addItem.bind(cartStore),
    updateQuantity: cartStore.updateQuantity.bind(cartStore),
    removeItem: cartStore.removeItem.bind(cartStore),
    setDiscount: cartStore.setDiscount.bind(cartStore),
    setPaymentMethod: cartStore.setPaymentMethod.bind(cartStore),
    setCashReceived: cartStore.setCashReceived.bind(cartStore),
    clear: cartStore.clear.bind(cartStore),
  };
}
