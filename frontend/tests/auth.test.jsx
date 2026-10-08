import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../src/api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), interceptors: { response: { use: vi.fn() } } },
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

import api from '../src/api/client';
import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());

// logged-in: /auth/me returns the user and the dashboard's /groups fetch returns no groups
const loggedIn = (user) =>
  api.get.mockImplementation((url) =>
    Promise.resolve({ data: { data: url === '/auth/me' ? { user } : { groups: [] } } })
  );

describe('auth flow', () => {
  it('redirects logged-out users from /dashboard to login', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } });
    renderAt('/dashboard');
    expect(await screen.findByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('logs in and lands on the dashboard', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } });
    api.post.mockResolvedValue({ data: { data: { user: { _id: '1', name: 'Asha' } } } });
    api.get.mockImplementation((url) =>
      url === '/auth/me'
        ? Promise.reject({ response: { status: 401 } })
        : Promise.resolve({ data: { data: { groups: [] } } })
    );
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/your groups/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'password123' });
  });

  it('shows inline error for short password on register without calling API', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } });
    renderAt('/register');
    await userEvent.type(await screen.findByLabelText(/name/i), 'Asha');
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('returns to the invite link after logging in', async () => {
    api.get.mockImplementation((url) =>
      url === '/auth/me'
        ? Promise.reject({ response: { status: 401 } })
        : url.includes('/expenses')
          ? Promise.resolve({ data: { data: { expenses: [], page: 1, totalPages: 1 } } })
          : Promise.resolve({ data: { data: { group: { _id: 'g1', name: 'Goa Trip', inviteCode: 'ABCD1234', members: [] } } } })
    );
    api.post.mockImplementation((url) =>
      Promise.resolve({
        data: { data: url === '/auth/login' ? { user: { _id: '1', name: 'Asha' } } : { group: { _id: 'g1', name: 'Goa Trip' } } },
      })
    );
    renderAt('/join/ABCD1234');
    await userEvent.type(await screen.findByLabelText(/email/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('heading', { name: 'Goa Trip' })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/groups/join', { inviteCode: 'ABCD1234' });
  });

  it('shows dashboard for an already logged-in user at /login', async () => {
    loggedIn({ _id: '1', name: 'Asha' });
    renderAt('/login');
    await waitFor(() => expect(screen.getByText(/your groups/i)).toBeInTheDocument());
  });
});
