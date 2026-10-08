import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/dashboard" className="text-emerald-600 underline">Go home</Link>
    </div>
  );
}
