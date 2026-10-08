import api from './client';

const base = (groupId) => `/groups/${groupId}/expenses`;

export const listExpenses = (groupId, page = 1) =>
  api.get(`${base(groupId)}?page=${page}`).then((r) => r.data.data);
export const createExpense = (groupId, body) => api.post(base(groupId), body).then((r) => r.data.data.expense);
export const updateExpense = (groupId, id, body) =>
  api.put(`${base(groupId)}/${id}`, body).then((r) => r.data.data.expense);
export const deleteExpense = (groupId, id) => api.delete(`${base(groupId)}/${id}`);
