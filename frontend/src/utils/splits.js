import { rupeesToPaise } from './money';

// "33.33" -> 3333 basis points; NaN if negative or more than 2 decimals
export const percentToBp = (value) => {
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return rupeesToPaise(s); // same fixed-point parsing: 2 decimals -> integer hundredths
};

// How much is still unassigned: paise for exact, basis points for percentage, 0 for equal.
export const remaining = (amountPaise, splitType, participants, shares) => {
  if (splitType === 'equal') return 0;
  const parse = splitType === 'exact' ? rupeesToPaise : percentToBp;
  const target = splitType === 'exact' ? amountPaise : 10000;
  const assigned = participants.reduce((sum, id) => sum + (parse(shares[id] ?? '') || 0), 0);
  return target - assigned;
};

// Rebuild percentage inputs from stored paise splits when editing (last person absorbs rounding).
export const percentagesFromSplits = (amount, splits) => {
  const bps = splits.map((s) => Math.round((s.amount * 10000) / amount));
  bps[bps.length - 1] = 10000 - bps.slice(0, -1).reduce((a, b) => a + b, 0);
  return Object.fromEntries(splits.map((s, i) => [s.user._id, (bps[i] / 100).toString()]));
};
