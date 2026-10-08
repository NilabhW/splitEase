import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import BalanceLabel from '../components/BalanceLabel';
import CreateGroupModal from '../components/CreateGroupModal';
import JoinGroupModal from '../components/JoinGroupModal';
import useAsync from '../hooks/useAsync';
import { listGroups } from '../api/groups';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: groups, loading, error, reload } = useAsync(listGroups, []);
  const [modal, setModal] = useState(null);
  const openGroup = (g) => navigate(`/groups/${g._id}`);

  let body;
  if (loading) body = <Spinner />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!groups.length)
    body = (
      <EmptyState title="No groups yet — create one for your flat or trip, or join with an invite code." />
    );
  else
    body = (
      <ul className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <li key={g._id}>
            <Link to={`/groups/${g._id}`} className="block rounded-xl border bg-white p-4 shadow-sm hover:border-emerald-400">
              <p className="font-semibold">{g.name}</p>
              <p className="text-sm text-gray-500">{g.members.length} member{g.members.length === 1 ? '' : 's'}</p>
              <p className="mt-2 text-sm font-medium"><BalanceLabel amount={g.netBalance} /></p>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Your groups</h1>
        <div className="flex gap-2">
          <button onClick={() => setModal('join')} className="rounded border border-emerald-600 px-3 py-1.5 text-emerald-700">Join group</button>
          <button onClick={() => setModal('create')} className="rounded bg-emerald-600 px-3 py-1.5 text-white">Create group</button>
        </div>
      </div>
      {body}
      {modal === 'create' && <CreateGroupModal onClose={() => setModal(null)} onCreated={openGroup} />}
      {modal === 'join' && <JoinGroupModal onClose={() => setModal(null)} onJoined={openGroup} />}
    </Layout>
  );
}
