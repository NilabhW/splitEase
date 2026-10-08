import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../src/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), interceptors: { response: { use: vi.fn() } } },
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

import api from '../src/api/client';
import toast from 'react-hot-toast';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';

const asha = { _id: 'u1', name: 'Asha' };
const bob = { _id: 'u2', name: 'Bob' };
const cara = { _id: 'u3', name: 'Cara' };
const group = { _id: 'g1', name: 'Goa Trip', inviteCode: 'ABCD1234', members: [asha, bob, cara] };

const balances = {
  balances: [
    { user: asha, net: -5000 },
    { user: bob, net: 5000 },
    { user: cara, net: 0 },
  ],
  plan: [{ from: asha, to: bob, amount: 5000 }],
};

const mockGets = (extra = {}) =>
  api.get.mockImplementation((url) => {
    const routes = {
      '/auth/me': { user: asha },
      '/groups': { groups: [] },
      '/groups/g1': { group },
      '/groups/g1/balances': balances,
      '/groups/g1/activity': { activity: [] },
      ...extra,
    };
    if (url.startsWith('/groups/g1/expenses'))
      return Promise.resolve({ data: { data: { expenses: [], page: 1, totalPages: 1 } } });
    return url in routes ? Promise.resolve({ data: { data: routes[url] } }) : Promise.reject({ response: { status: 404 } });
  });

const renderGroup = () =>
  render(
    <MemoryRouter initialEntries={['/groups/g1']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

const tab = async (name) => userEvent.click(await screen.findByRole('tab', { name }));

beforeEach(() => vi.clearAllMocks());

describe('settle up', () => {
  it('"Mark as paid" opens the settle-up form pre-filled and records the payment', async () => {
    mockGets();
    api.post.mockResolvedValue({ data: { data: { settlement: {} } } });
    renderGroup();
    await tab(/balances/i);
    await userEvent.click(await screen.findByRole('button', { name: /mark as paid/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/^from/i)).toHaveValue('u1');
    expect(within(dialog).getByLabelText(/^to/i)).toHaveValue('u2');
    expect(within(dialog).getByLabelText(/amount/i)).toHaveValue('50.00');
    await userEvent.type(within(dialog).getByLabelText(/note/i), 'GPay');
    await userEvent.click(within(dialog).getByRole('button', { name: /record payment/i }));
    expect(api.post).toHaveBeenCalledWith('/groups/g1/settlements', { from: 'u1', to: 'u2', amount: 5000, note: 'GPay' });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    // balances refetched after recording
    await waitFor(() => expect(api.get.mock.calls.filter(([u]) => u === '/groups/g1/balances').length).toBe(2));
  });

  it('only offers "Mark as paid" for payments involving me', async () => {
    mockGets({ '/groups/g1/balances': { ...balances, plan: [{ from: cara, to: bob, amount: 100 }] } });
    renderGroup();
    await tab(/balances/i);
    expect(await screen.findByText(/cara pays bob/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as paid/i })).not.toBeInTheDocument();
  });

  it('validates that I am the payer or receiver and the people differ', async () => {
    mockGets();
    renderGroup();
    await userEvent.click(await screen.findByRole('button', { name: /settle up/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^from/i), 'u3');
    await userEvent.selectOptions(within(dialog).getByLabelText(/^to/i), 'u2');
    await userEvent.type(within(dialog).getByLabelText(/amount/i), '10');
    await userEvent.click(within(dialog).getByRole('button', { name: /record payment/i }));
    expect(await within(dialog).findByText(/you must be the payer or the receiver/i)).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText(/^from/i), 'u2');
    await userEvent.click(within(dialog).getByRole('button', { name: /record payment/i }));
    expect(await within(dialog).findByText(/choose two different people/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('activity tab', () => {
  it('shows expenses and settlements in one timeline', async () => {
    mockGets({
      '/groups/g1/activity': {
        activity: [
          { type: 'settlement', _id: 's1', date: '2026-10-09T10:00:00Z', amount: 5000, from: bob, to: asha, note: 'cash', createdBy: bob },
          { type: 'expense', _id: 'e1', date: '2026-10-08T10:00:00Z', description: 'Hotel', amount: 30000, paidBy: asha, createdBy: asha },
        ],
      },
    });
    renderGroup();
    await tab(/activity/i);
    expect(await screen.findByText(/bob paid you ₹50\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/cash/)).toBeInTheDocument();
    expect(screen.getByText(/you added "hotel"/i)).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockGets();
    renderGroup();
    await tab(/activity/i);
    expect(await screen.findByText(/no activity yet/i)).toBeInTheDocument();
  });
});

describe('leave group', () => {
  it('confirms, then leaves and returns to the dashboard', async () => {
    mockGets();
    api.delete.mockResolvedValue({ data: { data: {} } });
    renderGroup();
    await userEvent.click(await screen.findByRole('button', { name: /leave group/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^leave$/i }));
    expect(api.delete).toHaveBeenCalledWith('/groups/g1/leave');
    expect(await screen.findByText(/your groups/i)).toBeInTheDocument();
  });

  it('shows the server reason when leaving is refused', async () => {
    mockGets();
    api.delete.mockRejectedValue({ response: { status: 400, data: { error: { message: 'Settle up first' } } } });
    renderGroup();
    await userEvent.click(await screen.findByRole('button', { name: /leave group/i }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^leave$/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Settle up first'));
  });
});
