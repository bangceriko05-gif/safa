export function createPosCustomItem(name: string, amount: number) {
  const productName = name.trim();
  if (!productName || !Number.isSafeInteger(amount) || amount < 0) return null;
  return {
    product_id: null,
    product_name: productName,
    quantity: 1,
    unit_price: amount,
    unit_cost: null,
  };
}