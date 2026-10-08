import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../utils/apiError';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    return errs;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created');
      navigate('/dashboard');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (k, label, type = 'text') => (
    <label className="block">{label}
      <input type={type} value={form[k]} onChange={set(k)} className="mt-1 w-full rounded border p-2" />
      {errors[k] && <span className="text-sm text-red-600">{errors[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto mt-16 max-w-sm space-y-4 p-4">
      <h1 className="text-2xl font-bold">Create your account</h1>
      {field('name', 'Name')}
      {field('email', 'Email', 'email')}
      {field('password', 'Password', 'password')}
      <button disabled={submitting} className="w-full rounded bg-emerald-600 p-2 text-white disabled:opacity-50">
        {submitting ? 'Creating…' : 'Sign up'}
      </button>
      <p>Have an account? <Link to="/login" className="text-emerald-600 underline">Log in</Link></p>
    </form>
  );
}
