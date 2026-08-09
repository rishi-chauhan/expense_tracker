const API_BASE = '/api';

/**
 * Shared API helper. Throws Error with .status and .data on failure.
 * Upload special cases (needsCardInfo, isDuplicate) are exposed via err.data.
 */
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);

  // CSV export returns text, not JSON
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!res.ok) {
      const err = new Error(res.statusText || 'Export failed');
      err.status = res.status;
      throw err;
    }
    return res;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error(res.statusText || 'Invalid JSON response');
    err.status = res.status;
    throw err;
  }

  // Preserve special upload outcomes even when success === false
  if (data?.needsCardInfo || data?.isDuplicate) {
    const err = new Error(data.error || (data.isDuplicate ? 'Duplicate statement' : 'Card info required'));
    err.status = res.status;
    err.data = data;
    err.needsCardInfo = Boolean(data.needsCardInfo);
    err.isDuplicate = Boolean(data.isDuplicate);
    throw err;
  }

  if (!res.ok || data.success === false) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const health = () => api('/health');

export const getTransactions = (cardId) =>
  api(`/transactions${cardId ? `?cardId=${cardId}` : ''}`);

export const getCards = () => api('/cards');

export const getStatements = () => api('/statements');

export const uploadCSV = (formData) =>
  api('/upload', { method: 'POST', body: formData });

export const deleteStatement = (id) =>
  api(`/statements/${id}`, { method: 'DELETE' });

export const chatHealth = () => api('/chat/health');

export const chat = (question) =>
  api('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

export const getCategories = () => api('/categories');

export const createCategory = (payload) =>
  api('/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const updateCategory = (id, payload) =>
  api(`/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const deleteCategory = (id) =>
  api(`/categories/${id}`, { method: 'DELETE' });

export const createCategoryRule = (payload) =>
  api('/categories/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const deleteCategoryRule = (id) =>
  api(`/categories/rules/${id}`, { method: 'DELETE' });

export const applyCategoryRules = () =>
  api('/categories/apply-rules', { method: 'POST' });

export const setTransactionCategory = (txId, categoryId) =>
  api(`/transactions/${txId}/category`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId }),
  });

export const getBudgets = (month) =>
  api(`/budgets${month ? `?month=${month}` : ''}`);

export const upsertBudget = (payload) =>
  api('/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const deleteBudget = (categoryId) =>
  api(`/budgets/${categoryId}`, { method: 'DELETE' });

export const getRecurring = () => api('/recurring');

/**
 * Download filtered transactions as CSV (triggers browser download)
 */
export async function exportTransactions(params = {}) {
  const qs = new URLSearchParams();
  if (params.cardId) qs.set('cardId', params.cardId);
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  const query = qs.toString();
  const res = await api(`/export${query ? `?${query}` : ''}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { api, API_BASE };
