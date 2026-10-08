import { render, screen } from '@testing-library/react';
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
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';

const asha = { _id: 'u1', name: 'Asha' };
const bob = { _id: 'u2', name: 'Bob' };
const cara = { _id: 'u3', name: 'Cara' };
const group = { _id: 'g1', name: 'Goa Trip', inviteCode: 'ABCD1234', members: [asha, bob, cara] };

const mockGets = (balances) =>
  api.get.mockImplementation((url) => {
    if (url === '/auth/me') return Promise.resolve({ data: { data: { user: asha } } });
    if (url === '/groups/g1') return Promise.resolve({ data: { data: { group } } });
    if (url === '/groups/g1/balances') return Promise.resolve({ data: { data: balances } });
    if (url.startsWith('/groups/g1/expenses'))
      return Promise.resolve({ data: { data: { expenses: [], page: 1, totalPages: 1 } } });
    return Promise.reject({ response: { status: 404 } });
  });

const openBalances = async () => {
  render(
    <MemoryRouter initialEntries={['/groups/g1']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
  await userEvent.click(await screen.findByRole('tab', { name: /balances/i }));
};

beforeEach(() => vi.clearAllMocks());

it('shows net balances and suggested payments', async () => {
  mockGets({
    balances: [
      { user: asha, net: 10000 },
      { user: bob, net: 15000 },
      { user: cara, net: -25000 },
    ],
    plan: [
      { from: cara, to: bob, amount: 15000 },
      { from: cara, to: asha, amount: 10000 },
    ],
  });
  await openBalances();
  expect(await screen.findByText(/gets back ₹150\.00/i)).toBeInTheDocument();
  expect(screen.getByText(/owes ₹250\.00/i)).toBeInTheDocument();
  expect(screen.getByText(/you get back ₹100\.00/i)).toBeInTheDocument();
  expect(screen.getByText(/suggested payments/i)).toBeInTheDocument();
  expect(screen.getByText(/cara pays bob/i)).toBeInTheDocument();
  expect(screen.getByText(/cara pays you/i)).toBeInTheDocument();
});

it('shows a settled-up message when there is nothing to pay', async () => {
  mockGets({ balances: [{ user: asha, net: 0 }, { user: bob, net: 0 }], plan: [] });
  await openBalances();
  expect(await screen.findByText(/everyone is settled up/i)).toBeInTheDocument();
});
