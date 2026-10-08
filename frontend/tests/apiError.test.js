import { errorMessage } from '../src/utils/apiError';

it('uses the server message when there is one', () => {
  expect(errorMessage({ response: { data: { error: { message: 'Email is already registered' } } } })).toBe(
    'Email is already registered'
  );
});

it('explains when the server could not be reached', () => {
  expect(errorMessage({ request: {}, message: 'Network Error' })).toMatch(/can't reach the server/i);
});

it('falls back to a generic message', () => {
  expect(errorMessage(new Error('boom'))).toBe('Something went wrong, please try again.');
  expect(errorMessage({ response: { status: 500, data: '<html>' } })).toBe('Something went wrong, please try again.');
});
