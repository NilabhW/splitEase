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
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';

const asha = { _id: 'u1', name: 'Asha' };
const bob = { _id: 'u2', name: 'Bob' };
const group = { _id: 'g1', name: 'Goa Trip', inviteCode: 'ABCD1234', members: [asha, bob] };
const expense = (over = {}) => ({
  _id: 'e1',
  description: 'Dinner',
  amount: 10000,
  paidBy: asha,
  createdBy: asha,
  splitType: 'equal',
  splits: [
    { user: asha, amount: 5000 },
    { user: bob, amount: 5000 },
  ],
  date: '2026-10-08T00:00:00.000Z',
  ...over,
});

const mockGets = (expenses) =>
  api.get.mockImplementation((url) => {
    if (url === '/auth/me') return Promise.resolve({ data: { data: { user: asha } } });
    if (url === '/groups/g1') return Promise.resolve({ data: { data: { group } } });
    if (url.startsWith('/groups/g1/expenses'))
      return Promise.resolve({ data: { data: { expenses, page: 1, totalPages: 1, total: expenses.length } } });
    return Promise.reject({ response: { status: 404 } });
  });

const renderGroup = () =>
  render(
    <MemoryRouter initialEntries={['/groups/g1']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

const openAdd = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /add expense/i }));
  return screen.getByRole('dialog');
};

beforeEach(() => vi.clearAllMocks());

describe('expenses tab', () => {
  it('shows an empty state with an add button', async () => {
    mockGets([]);
    renderGroup();
    expect(await screen.findByText(/no expenses yet/i)).toBeInTheDocument();
  });

  it('lists expenses with payer, amount and my share', async () => {
    mockGets([expense({ paidBy: bob, createdBy: bob })]);
    renderGroup();
    expect(await screen.findByText('Dinner')).toBeInTheDocument();
    expect(screen.getByText(/bob paid ₹100\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/your share ₹50\.00/i)).toBeInTheDocument();
    // not the creator: no edit/delete
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('adds an equal split expense with amounts converted to paise', async () => {
    mockGets([]);
    api.post.mockResolvedValue({ data: { data: { expense: expense() } } });
    renderGroup();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText(/description/i), 'Dinner');
    await userEvent.type(within(dialog).getByLabelText(/amount/i), '100.50');
    expect(within(dialog).getByText(/₹50\.25 each/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /save/i }));
    expect(api.post).toHaveBeenCalledWith('/groups/g1/expenses', {
      description: 'Dinner',
      amount: 10050,
      paidBy: 'u1',
      splitType: 'equal',
      participants: ['u1', 'u2'],
    });
  });

  it('exact split: shows remaining and only enables save at zero', async () => {
    mockGets([]);
    api.post.mockResolvedValue({ data: { data: { expense: expense() } } });
    renderGroup();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText(/description/i), 'Groceries');
    await userEvent.type(within(dialog).getByLabelText(/amount/i), '100');
    await userEvent.click(within(dialog).getByRole('button', { name: /exact/i }));
    await userEvent.type(within(dialog).getByLabelText(/asha's share/i), '60');
    expect(within(dialog).getByText(/₹40\.00 left/i)).toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: /save/i });
    expect(save).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/bob's share/i), '40');
    expect(within(dialog).getByText(/₹0\.00 left/i)).toBeInTheDocument();
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(api.post).toHaveBeenCalledWith('/groups/g1/expenses', expect.objectContaining({
      splitType: 'exact',
      amount: 10000,
      shares: { u1: 6000, u2: 4000 },
    }));
  });

  it('percentage split: tracks remaining percent', async () => {
    mockGets([]);
    api.post.mockResolvedValue({ data: { data: { expense: expense() } } });
    renderGroup();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText(/description/i), 'Cab');
    await userEvent.type(within(dialog).getByLabelText(/amount/i), '300');
    await userEvent.click(within(dialog).getByRole('button', { name: /percentage/i }));
    await userEvent.type(within(dialog).getByLabelText(/asha's share/i), '33.33');
    expect(within(dialog).getByText(/66\.67% left/i)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/bob's share/i), '66.67');
    await userEvent.click(within(dialog).getByRole('button', { name: /save/i }));
    expect(api.post).toHaveBeenCalledWith('/groups/g1/expenses', expect.objectContaining({
      splitType: 'percentage',
      shares: { u1: 33.33, u2: 66.67 },
    }));
  });

  it('unticking a participant removes them from the split', async () => {
    mockGets([]);
    api.post.mockResolvedValue({ data: { data: { expense: expense() } } });
    renderGroup();
    const dialog = await openAdd();
    await userEvent.type(within(dialog).getByLabelText(/description/i), 'Snacks');
    await userEvent.type(within(dialog).getByLabelText(/amount/i), '50');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Bob' }));
    await userEvent.click(within(dialog).getByRole('button', { name: /save/i }));
    expect(api.post).toHaveBeenCalledWith('/groups/g1/expenses', expect.objectContaining({ participants: ['u1'] }));
  });

  it('edits my own expense with prefilled values', async () => {
    mockGets([expense()]);
    api.put.mockResolvedValue({ data: { data: { expense: expense({ description: 'Big dinner' }) } } });
    renderGroup();
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const dialog = screen.getByRole('dialog');
    const desc = within(dialog).getByLabelText(/description/i);
    expect(desc).toHaveValue('Dinner');
    expect(within(dialog).getByLabelText(/amount/i)).toHaveValue('100.00');
    await userEvent.clear(desc);
    await userEvent.type(desc, 'Big dinner');
    await userEvent.click(within(dialog).getByRole('button', { name: /save/i }));
    expect(api.put).toHaveBeenCalledWith('/groups/g1/expenses/e1', expect.objectContaining({ description: 'Big dinner', amount: 10000 }));
  });

  it('deletes my own expense after confirming', async () => {
    mockGets([expense()]);
    api.delete.mockResolvedValue({ data: { data: {} } });
    renderGroup();
    await userEvent.click(await screen.findByRole('button', { name: /delete/i }));
    const dialog = screen.getByRole('dialog');
    expect(api.delete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/groups/g1/expenses/e1'));
  });
});
