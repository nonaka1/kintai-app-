import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function calcWorkHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null;
  const [h1, m1, s1] = clockIn.split(':').map(Number);
  const [h2, m2, s2] = clockOut.split(':').map(Number);
  const totalMin = (h2 * 60 + m2 + s2 / 60) - (h1 * 60 + m1 + s1 / 60);
  const hours = Math.floor(totalMin / 60);
  const mins = Math.round(totalMin % 60);
  return { hours, mins, totalMin };
}

function LocationBadge({ lat, lng }) {
  if (!lat && !lng) return <span className="loc-none">--</span>;
  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="loc-link" title={`${lat}, ${lng}`}>
      MAP
    </a>
  );
}

export default function MonthlyPage() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('');

  useEffect(() => {
    if (user.role === 'admin') {
      api.get('/staff').then(res => setStaffList(res.data.staff));
    }
  }, [user.role]);

  useEffect(() => {
    fetchMonthly();
  }, [year, month, selectedStaff]);

  const fetchMonthly = async () => {
    const params = { year, month };
    if (user.role === 'admin' && selectedStaff) {
      params.staff_id = selectedStaff;
    }
    try {
      const res = await api.get('/attendance/monthly', { params });
      setRecords(res.data.records);
    } catch (err) {
      console.error(err);
    }
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  const recordMap = {};
  records.forEach(r => { recordMap[r.date] = r; });

  let totalMinutes = 0;
  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const rec = recordMap[dateStr];
    const work = rec ? calcWorkHours(rec.clock_in, rec.clock_out) : null;
    if (work) totalMinutes += work.totalMin;
    rows.push({ d, dateStr, dayOfWeek, rec, work });
  }

  const totalH = Math.floor(totalMinutes / 60);
  const totalM = Math.round(totalMinutes % 60);

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  return (
    <div className="monthly-container">
      <div className="monthly-header">
        <div className="month-nav">
          <button onClick={prevMonth} className="btn btn-sm">&lt;</button>
          <h2>{year}年 {month}月</h2>
          <button onClick={nextMonth} className="btn btn-sm">&gt;</button>
        </div>
        {user.role === 'admin' && (
          <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="staff-select">
            <option value="">自分</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="monthly-summary">
        合計勤務時間: <strong>{totalH}時間 {totalM}分</strong>
      </div>

      <div className="table-wrapper">
        <table className="monthly-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>曜日</th>
              <th>出勤</th>
              <th>退勤</th>
              <th>勤務時間</th>
              {user.role === 'admin' && <th>位置</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, dayOfWeek, rec, work }) => (
              <tr key={d} className={dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : ''}>
                <td>{d}日</td>
                <td>{dayNames[dayOfWeek]}</td>
                <td>{rec?.clock_in || ''}</td>
                <td>{rec?.clock_out || ''}</td>
                <td>{work ? `${work.hours}時間${work.mins}分` : ''}</td>
                {user.role === 'admin' && (
                  <td className="loc-cell">
                    {rec?.clock_in && (
                      <>
                        <span className="loc-label">入</span>
                        <LocationBadge lat={rec.clock_in_lat} lng={rec.clock_in_lng} />
                        {rec.clock_out && (
                          <>
                            {' '}
                            <span className="loc-label">退</span>
                            <LocationBadge lat={rec.clock_out_lat} lng={rec.clock_out_lng} />
                          </>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
