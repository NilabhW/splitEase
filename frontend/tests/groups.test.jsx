import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../src/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), interceptors: { response: { use: vi.fn() } } },
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

import api from '../src/api/client';
import toast from 'react-hot-toast';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';

const me = { _id: 'u1', name: 'Asha', email: 'asha@example.com' };
const group = (over = {}) => ({
  _id: 'g1',
  name: 'Goa Trip',
  description: '',
  inviteCode: 'ABCD1234',
  members: [me],
  netBalance: 0,
  ...over,
});

// route GET calls by URL so the auth check and page fetches can coexist
const mockGets = (routes) =>
  api.get.mockImplementation((url) => {
    if (url === '/auth/me') return Promise.resolve({ data: { data: { user: me } } });
    const r = routes[url];
    if (!r) return Promise.reject({ response: { status: 404, data: { error: { message: 'nope' } } } });
    return r instanceof Error ? Promise.reject(r) : Promise.resolve({ data: { data: r } });
  });

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

describe('dashboard', () => {
  it('shows an empty state when the user has no groups', async () => {
    mockGets({ '/groups': { groups: [] } });
    renderAt('/dashboard');
    expect(await screen.findByText(/no groups yet/i)).toBeInTheDocument();
  });

  it('lists groups with net balance labels', async () => {
    mockGets({
      '/groups': {
        groups: [
          group({ _id: 'g1', name: 'Goa Trip', netBalance: 12550 }),
          group({ _id: 'g2', name: 'Flat', netBalance: -5000 }),
          group({ _id: 'g3', name: 'Office', netBalance: 0 }),
        ],
      },
    });
    renderAt('/dashboard');
    expect(await screen.findByText('Goa Trip')).toBeInTheDocument();
    expect(screen.getByText(/you are owed ₹125\.50/i)).toBeInTheDocument();
    expect(screen.getByText(/you owe ₹50\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/settled up/i)).toBeInTheDocument();
  });

  it('shows an error with a retry button when loading fails', async () => {
    mockGets({ '/groups': new Error('down') });
    renderAt('/dashboard');
    const retry = await screen.findByRole('button', { name: /retry/i });
    mockGets({ '/groups': { groups: [group()] } });
    await userEvent.click(retry);
    expect(await screen.findByText('Goa Trip')).toBeInTheDocument();
  });

  it('creates a group and opens it', async () => {
    mockGets({ '/groups': { groups: [] }, '/groups/g9': { group: group({ _id: 'g9', name: 'Hostel' }) } });
    api.post.mockResolvedValue({ data: { data: { group: group({ _id: 'g9', name: 'Hostel' }) } } });
    renderAt('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: /create group/i }));
    await userEvent.type(screen.getByLabelText(/group name/i), 'Hostel');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(api.post).toHaveBeenCalledWith('/groups', { name: 'Hostel', description: '' });
    expect(await screen.findByRole('heading', { name: 'Hostel' })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it('validates the group name before calling the API', async () => {
    mockGets({ '/groups': { groups: [] } });
    renderAt('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: /create group/i }));
    await userEvent.type(screen.getByLabelText(/group name/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('joins a group with an invite code', async () => {
    mockGets({ '/groups': { groups: [] }, '/groups/g1': { group: group() } });
    api.post.mockResolvedValue({ data: { data: { group: group() } } });
    renderAt('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: /join group/i }));
    await userEvent.type(screen.getByLabelText(/invite code/i), 'abcd1234');
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }));
    expect(api.post).toHaveBeenCalledWith('/groups/join', { inviteCode: 'ABCD1234' });
    expect(await screen.findByRole('heading', { name: 'Goa Trip' })).toBeInTheDocument();
  });
});

describe('join link', () => {
  it('auto-joins via /join/:code and redirects to the group', async () => {
    mockGets({ '/groups/g1': { group: group() } });
    api.post.mockResolvedValue({ data: { data: { group: group() } } });
    renderAt('/join/ABCD1234');
    expect(await screen.findByRole('heading', { name: 'Goa Trip' })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/groups/join', { inviteCode: 'ABCD1234' });
  });

  it('goes to the group if already a member (409)', async () => {
    mockGets({ '/groups/g1': { group: group() } });
    api.post.mockRejectedValue({
      response: { status: 409, data: { error: { code: 'ALREADY_MEMBER', message: 'already', details: { groupId: 'g1' } } } },
    });
    renderAt('/join/ABCD1234');
    expect(await screen.findByRole('heading', { name: 'Goa Trip' })).toBeInTheDocument();
  });

  it('shows an error for an invalid code', async () => {
    mockGets({});
    api.post.mockRejectedValue({ response: { status: 404, data: { error: { message: 'Invalid invite code' } } } });
    renderAt('/join/ZZZZZZZZ');
    expect(await screen.findByText(/invalid invite code/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });
});

describe('group page', () => {
  it('shows members and the invite code', async () => {
    mockGets({ '/groups/g1': { group: group({ members: [me, { _id: 'u2', name: 'Bob' }] }) } });
    renderAt('/groups/g1');
    expect(await screen.findByRole('heading', { name: 'Goa Trip' })).toBeInTheDocument();
    expect(screen.getByText('ABCD1234')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows not-found for a group the user cannot access', async () => {
    mockGets({});
    renderAt('/groups/zzz');
    await waitFor(() => expect(screen.getByText(/nope/i)).toBeInTheDocument());
  });
});
