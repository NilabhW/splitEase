import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

// Remember where a logged-out user was going (e.g. an invite link) so login can send them back.
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  return user ? <Navigate to={location.state?.from || '/dashboard'} replace /> : children;
}
