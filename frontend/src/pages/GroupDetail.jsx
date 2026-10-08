import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import useAsync from '../hooks/useAsync';
import { getGroup } from '../api/groups';

export default function GroupDetail() {
  const { id } = useParams();
  const { data: group, loading, error, reload } = useAsync(() => getGroup(id), [id]);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy, please copy it manually');
    }
  };

  if (loading) return <Layout><Spinner /></Layout>;
  if (error)
    return (
      <Layout>
        <ErrorState error={error} onRetry={error.response?.status >= 500 || !error.response ? reload : undefined} />
        <p className="mt-4 text-center"><Link to="/dashboard" className="text-emerald-600 underline">Back to dashboard</Link></p>
      </Layout>
    );

  const joinLink = `${window.location.origin}/join/${group.inviteCode}`;

  return (
    <Layout>
      <Link to="/dashboard" className="text-sm text-gray-500">← All groups</Link>
      <h1 className="mt-1 text-2xl font-bold">{group.name}</h1>
      {group.description && <p className="text-gray-600">{group.description}</p>}

      <section className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm">
        <span className="text-gray-500">Invite code</span>
        <code className="rounded bg-gray-100 px-2 py-0.5 font-mono tracking-widest">{group.inviteCode}</code>
        <button onClick={() => copy(group.inviteCode, 'Code')} className="text-emerald-700 underline">Copy code</button>
        <button onClick={() => copy(joinLink, 'Invite link')} className="text-emerald-700 underline">Copy link</button>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">Members ({group.members.length})</h2>
        <ul className="divide-y rounded-xl border bg-white">
          {group.members.map((m) => (
            <li key={m._id} className="px-4 py-2">{m.name}</li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
