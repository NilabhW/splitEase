import { formatPaise } from '../utils/money';

export default function BalanceLabel({ amount }) {
  if (amount > 0) return <span className="text-emerald-600">You are owed {formatPaise(amount)}</span>;
  if (amount < 0) return <span className="text-red-600">You owe {formatPaise(-amount)}</span>;
  return <span className="text-gray-500">Settled up</span>;
}
