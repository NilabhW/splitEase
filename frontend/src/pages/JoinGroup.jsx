import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import { joinGroup } from '../api/groups';

export default function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const started = useRef(false); // StrictMode runs effects twice; join only once

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    joinGroup(code.toUpperCase())
      .then((group) => {
        toast.success(`Joined ${group.name}`);
        navigate(`/groups/${group._id}`, { replace: true });
      })
      .catch((err) => {
        const groupId = err.response?.status === 409 && err.response.data?.error?.details?.groupId;
        if (groupId) navigate(`/groups/${groupId}`, { replace: true });
        else setError(err);
      });
  }, [code, navigate]);

  return (
    <Layout>
      {error ? (
        <div className="space-y-4 text-center">
          <ErrorState error={error} />
          <Link to="/dashboard" className="text-emerald-600 underline">Back to dashboard</Link>
        </div>
      ) : (
        <Spinner />
      )}
    </Layout>
  );
}
