import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWidget from '../components/ChatWidget';

const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const periods = [
  { number: 1, time: '09:00 - 09:55' },
  { number: 2, time: '09:55 - 10:50' },
  { number: 'Break', time: '10:50 - 11:05' },
  { number: 3, time: '11:05 - 12:00' },
  { number: 4, time: '12:00 - 12:55' },
  { number: 'Lunch', time: '12:55 - 01:45' },
  { number: 5, time: '01:45 - 02:40' },
  { number: 6, time: '02:40 - 03:35' },
  { number: 7, time: '03:35 - 04:20' },
];

export default function StudentTimetable() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/api/student/timetable', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load timetable.');
        setEntries(payload.timetable || []);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role="student" />
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Student timetable</div>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Weekly class schedule</h1>
            <p className="mt-2 text-sm text-slate-500">College timing: 09:00 AM to 04:20 PM</p>
          </div>
          <div className="flex gap-2 text-xs font-semibold">
            <span className="rounded-full bg-amber-100 px-3 py-2 text-amber-800">Break: 10:50 - 11:05</span>
            <span className="rounded-full bg-sky-100 px-3 py-2 text-sky-800">Lunch: 12:55 - 01:45</span>
          </div>
        </div>

        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {loading && <div className="mb-4 rounded-lg bg-white px-4 py-3 text-sm text-slate-500">Loading timetable…</div>}

        <div className="overflow-x-auto rounded-xl bg-white shadow-soft">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900 text-left text-white">
                <th className="w-28 border border-slate-700 px-4 py-3 font-semibold">Period</th>
                {days.map((day) => (
                  <th key={day} className="border border-slate-700 px-3 py-3 text-center font-semibold">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period, rowIndex) => {
                const isBreak = period.number === 'Break';
                const isLunch = period.number === 'Lunch';
                return (
                  <tr key={`${period.number}-${period.time}`} className={isBreak || isLunch ? 'bg-slate-100' : 'bg-white'}>
                    <th className="border border-slate-200 px-4 py-3 align-middle text-slate-800">
                      {typeof period.number === 'number' ? `Period ${period.number}` : period.number}
                      <div className="mt-1 text-xs font-normal text-slate-500">{period.time}</div>
                    </th>
                    {days.map((day) => {
                      const dayNames = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday' };
                      const value = entries.filter((entry) => entry.day.toLowerCase() === dayNames[day].toLowerCase() && period.number >= Number(entry.period) && period.number < Number(entry.period) + Number(entry.duration_periods || 1)).map((entry) => `${entry.subject}${entry.room ? ` · ${entry.room}` : ''}`).join('\n') || 'No class';
                      if (isBreak) return <td key={day} className="border border-slate-200 px-3 py-3 text-center font-semibold text-amber-700">BREAK</td>;
                      if (isLunch) return <td key={day} className="border border-slate-200 px-3 py-3 text-center font-semibold text-sky-700">LUNCH</td>;
                      return (
                        <td key={day} className="border border-slate-200 px-3 py-3 text-center text-slate-700">
                          <span className="whitespace-pre-line font-medium">{value}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && entries.length === 0 && <div className="mt-4 rounded-lg bg-white px-4 py-3 text-sm text-slate-500">No timetable entries have been published for your enrolled classes.</div>}
      </main>
      <ChatWidget />
    </div>
  );
}
