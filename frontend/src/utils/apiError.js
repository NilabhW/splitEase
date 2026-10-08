// Prefer the server's message; distinguish "no response" (offline, or the API is still waking up).
export const errorMessage = (err) => {
  const serverMessage = err?.response?.data?.error?.message;
  if (serverMessage) return serverMessage;
  if (err?.request && !err.response) return "Can't reach the server. Check your connection and try again.";
  return 'Something went wrong, please try again.';
};
