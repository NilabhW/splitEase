import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your groups</h1>
        <button onClick={logout} className="underline">Log out ({user.name})</button>
      </div>
    </div>
  );
}
