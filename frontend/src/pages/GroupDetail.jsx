import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import ExpensesTab from '../components/ExpensesTab';
import ExpenseModal from '../components/ExpenseModal';
import BalancesTab from '../components/BalancesTab';
import useAsync from '../hooks/useAsync';
import { getGroup } from '../api/groups';

const TABS = ['Expenses', 'Balances'];

export default function GroupDetail() {
  const { id } = useParams();
  const { data: group, loading, error, reload } = useAsync(() => getGroup(id), [id]);
  const [tab, setTab] = useState('Expenses');
  // bumping version makes tabs refetch after anything changes money in the group
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(null); // null | 'new' | expense
  const changed = () => setVersion((v) => v + 1);

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
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <button onClick={() => setEditing('new')} className="rounded bg-emerald-600 px-3 py-1.5 text-white">Add expense</button>
      </div>
      {group.description && <p className="text-gray-600">{group.description}</p>}

      <ul aria-label="Members" className="mt-3 flex flex-wrap gap-1.5 text-sm">
        {group.members.map((m) => (
          <li key={m._id} className="rounded-full bg-gray-200 px-2.5 py-0.5">{m.name}</li>
        ))}
      </ul>

      <section className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm">
        <span className="text-gray-500">Invite code</span>
        <code className="rounded bg-gray-100 px-2 py-0.5 font-mono tracking-widest">{group.inviteCode}</code>
        <button onClick={() => copy(group.inviteCode, 'Code')} className="text-emerald-700 underline">Copy code</button>
        <button onClick={() => copy(joinLink, 'Invite link')} className="text-emerald-700 underline">Copy link</button>
      </section>

      <div role="tablist" className="mt-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 ${tab === t ? 'border-emerald-600 font-semibold text-emerald-700' : 'border-transparent text-gray-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-4">
        {tab === 'Expenses' && (
          <ExpensesTab group={group} version={version} onAdd={() => setEditing('new')} onEdit={setEditing} onChanged={changed} />
        )}
        {tab === 'Balances' && <BalancesTab group={group} version={version} />}
      </div>

      {editing && (
        <ExpenseModal
          group={group}
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            changed();
          }}
        />
      )}
    </Layout>
  );
}
