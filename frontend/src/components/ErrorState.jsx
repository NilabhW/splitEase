import { errorMessage } from '../utils/apiError';

export default function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-xl bg-red-50 p-6 text-center text-red-700">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded bg-red-600 px-4 py-1.5 text-white">Retry</button>
      )}
    </div>
  );
}
