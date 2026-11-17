import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'student1@college.edu', password: 'student123' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Login failed');
      }

      localStorage.setItem('token', payload.token);
      localStorage.setItem('role', payload.user.role);
      localStorage.setItem('userName', payload.user.name);
      navigate(`/${payload.user.role}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-soft lg:grid-cols-2">
        <div className="bg-gradient-to-br from-sky-600 to-blue-900 p-10 text-white">
          <div className="text-sm uppercase tracking-[0.25em] text-sky-100">CampusCore</div>
          <h1 className="mt-10 text-4xl font-bold">AI-powered college management</h1>
          <p className="mt-4 text-sky-100">
            Manage academics, attendance, assignments, examinations, and insights from a single portal.
          </p>
          <div className="mt-10 space-y-4 text-sm text-sky-100">
            <div>• Student dashboards and attendance tracking</div>
            <div>• Teacher assignment and marks management</div>
            <div>• Admin-wide academic controls and reporting</div>
          </div>
        </div>

        <div className="p-8 md:p-12">
          <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-2 text-slate-500">Log in to your role-specific dashboard</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-blue-500"
                placeholder="you@college.edu"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>

            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Demo users: admin@college.edu / admin123, teacher1@college.edu / teacher123, student1@college.edu / student123.
          </div>
        </div>
      </div>
    </div>
  );
}
