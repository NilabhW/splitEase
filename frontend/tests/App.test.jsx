import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../src/api/client', () => ({
  default: { get: vi.fn().mockRejectedValue({ response: { status: 401 } }), post: vi.fn(), interceptors: { response: { use: vi.fn() } } },
}));

import App from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';

it('shows a friendly 404 for unknown routes', async () => {
  render(
    <MemoryRouter initialEntries={['/nope']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
  expect(await screen.findByText(/page not found/i)).toBeInTheDocument();
});
