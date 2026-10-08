export const errorMessage = (err) =>
  err?.response?.data?.error?.message || 'Something went wrong, please try again.';
