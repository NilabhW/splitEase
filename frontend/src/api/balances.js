import api from './client';

export const getBalances = (groupId) => api.get(`/groups/${groupId}/balances`).then((r) => r.data.data);
