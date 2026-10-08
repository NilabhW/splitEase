// All amounts from the API are integer paise; convert only at the edges.
export const formatPaise = (paise) => {
  const sign = paise < 0 ? '-' : '';
  return `${sign}₹${(Math.abs(paise) / 100).toFixed(2)}`;
};

// "125.5" -> 12550; returns NaN for anything that isn't a valid rupee amount
export const rupeesToPaise = (value) => {
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  const [r, p = ''] = s.split('.');
  return Number(r) * 100 + Number(p.padEnd(2, '0'));
};
