export interface ViewedProduct {
  id: string;
  name: string;
  category: string;
  timestamp: number;
}

export const addViewedProduct = (product: ViewedProduct) => {
  const history = getViewHistory();
  const filtered = history.filter(p => p.id !== product.id);
  filtered.unshift(product);
  const limited = filtered.slice(0, 15); // Keep last 15 viewed products
  localStorage.setItem('viewHistory', JSON.stringify(limited));
};

export const getViewHistory = (): ViewedProduct[] => {
  try {
    const data = localStorage.getItem('viewHistory');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};
