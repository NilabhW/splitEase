import api from './client';

export const listGroups = () => api.get('/groups').then((r) => r.data.data.groups);
export const getGroup = (id) => api.get(`/groups/${id}`).then((r) => r.data.data.group);
export const createGroup = (body) => api.post('/groups', body).then((r) => r.data.data.group);
export const joinGroup = (inviteCode) => api.post('/groups/join', { inviteCode }).then((r) => r.data.data.group);
