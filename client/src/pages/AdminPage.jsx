import { useState, useEffect } from 'react';
import api from '../api';

export default function AdminPage() {
  const [staffList, setStaffList] = useState([]);
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 店舗位置
  const [storeLat, setStoreLat] = useState('');
  const [storeLng, setStoreLng] = useState('');
  const [storeRadius, setStoreRadius] = useState('200');
  const [storeName, setStoreName] = useState('店舗');
  const [storeError, setStoreError] = useState('');
  const [storeSuccess, setStoreSuccess] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);

  // 本日の勤怠
  const [todayRecords, setTodayRecords] = useState([]);
  const [todayAllStaff, setTodayAllStaff] = useState([]);
  const [todayDate, setTodayDate] = useState('');

  useEffect(() => {
    fetchStaff();
    fetchStoreLocation();
    fetchTodayAll();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff');
      setStaffList(res.data.staff);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTodayAll = async () => {
    try {
      const res = await api.get('/attendance/today-all');
      setTodayRecords(res.data.records);
      setTodayAllStaff(res.data.allStaff);
      setTodayDate(res.data.date);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStoreLocation = async () => {
    try {
      const res = await api.get('/store-location');
      if (res.data.location) {
        const loc = res.data.location;
        setStoreLat(String(loc.latitude));
        setStoreLng(String(loc.longitude));
        setStoreRadius(String(loc.radius));
        setStoreName(loc.name || '店舗');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/staff', { name, login_id: loginId, password, role });
      setSuccess('スタッフを追加しました');
      setName('');
      setLoginId('');
      setPassword('');
      setRole('staff');
      fetchStaff();
    } catch (err) {
      setError(err.response?.data?.error || '追加に失敗しました');
    }
  };

  const handleDelete = async (id, staffName) => {
    if (!window.confirm(`${staffName}を削除しますか？関連する勤怠データもすべて削除されます。`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/staff/${id}`);
      setSuccess('スタッフを削除しました');
      fetchStaff();
    } catch (err) {
      setError(err.response?.data?.error || '削除に失敗しました');
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStoreError('このブラウザはGPSに対応していません');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStoreLat(String(pos.coords.latitude));
        setStoreLng(String(pos.coords.longitude));
        setGettingLocation(false);
      },
      (err) => {
        setStoreError('位置情報の取得に失敗しました');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveStore = async (e) => {
    e.preventDefault();
    setStoreError('');
    setStoreSuccess('');
    try {
      await api.post('/store-location', {
        latitude: parseFloat(storeLat),
        longitude: parseFloat(storeLng),
        radius: parseInt(storeRadius, 10),
        name: storeName
      });
      setStoreSuccess('店舗位置を保存しました');
    } catch (err) {
      setStoreError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const makeMapUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

  const recordMap = {};
  todayRecords.forEach(r => { recordMap[r.staff_id] = r; });

  return (
    <div className="admin-container">
      <h2>スタッフ管理</h2>

      {error && <div className="error-msg">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <div className="admin-section">
        <h3>本日の出勤状況（{todayDate}）</h3>
        <div className="table-wrapper">
          <table className="staff-table">
            <thead>
              <tr>
                <th>名前</th>
                <th>出勤</th>
                <th>出勤場所</th>
                <th>休憩</th>
                <th>戻り</th>
                <th>退勤</th>
                <th>退勤場所</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {todayAllStaff.map(s => {
                const rec = recordMap[s.id];
                let status = '未出勤';
                let statusClass = 'status-absent';
                if (rec?.clock_out) { status = '退勤済'; statusClass = 'status-done'; }
                else if (rec?.break_start && !rec?.break_end) { status = '休憩中'; statusClass = 'status-break'; }
                else if (rec?.clock_in) { status = '勤務中'; statusClass = 'status-working'; }
                return (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{rec?.clock_in || '--:--'}</td>
                    <td>
                      {rec?.clock_in_lat ? (
                        <a href={makeMapUrl(rec.clock_in_lat, rec.clock_in_lng)} target="_blank" rel="noopener noreferrer" className="loc-link">MAP</a>
                      ) : rec?.clock_in ? <span className="loc-none">位置なし</span> : ''}
                    </td>
                    <td>{rec?.break_start || '--:--'}</td>
                    <td>{rec?.break_end || '--:--'}</td>
                    <td>{rec?.clock_out || '--:--'}</td>
                    <td>
                      {rec?.clock_out_lat ? (
                        <a href={makeMapUrl(rec.clock_out_lat, rec.clock_out_lng)} target="_blank" rel="noopener noreferrer" className="loc-link">MAP</a>
                      ) : rec?.clock_out ? <span className="loc-none">位置なし</span> : ''}
                    </td>
                    <td><span className={`status-badge ${statusClass}`}>{status}</span></td>
                  </tr>
                );
              })}
              {todayAllStaff.length === 0 && (
                <tr><td colSpan="8" style={{textAlign:'center',color:'#888'}}>スタッフがいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <button onClick={fetchTodayAll} className="btn btn-sm" style={{marginTop:'12px'}}>更新</button>
      </div>

      <div className="admin-section">
        <h3>スタッフ追加</h3>
        <form onSubmit={handleAdd} className="admin-form">
          <div className="form-row">
            <div className="form-group">
              <label>名前</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>ログインID</label>
              <input type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>パスワード</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>権限</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="staff">スタッフ</option>
                <option value="admin">管理者</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">追加</button>
        </form>
      </div>

      <div className="admin-section">
        <h3>スタッフ一覧</h3>
        <div className="table-wrapper">
          <table className="staff-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>名前</th>
                <th>ログインID</th>
                <th>権限</th>
                <th>登録日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.login_id}</td>
                  <td>{s.role === 'admin' ? '管理者' : 'スタッフ'}</td>
                  <td>{s.created_at}</td>
                  <td>
                    <button onClick={() => handleDelete(s.id, s.name)} className="btn btn-danger btn-sm">
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-section">
        <h3>店舗位置設定（ジオフェンス）</h3>
        <p className="section-desc">店舗の位置と許容範囲を設定すると、範囲外からの打刻を制限できます。</p>

        {storeError && <div className="error-msg">{storeError}</div>}
        {storeSuccess && <div className="success-msg">{storeSuccess}</div>}

        <form onSubmit={handleSaveStore} className="admin-form">
          <div className="form-row">
            <div className="form-group">
              <label>店舗名</label>
              <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>緯度</label>
              <input type="number" step="any" value={storeLat} onChange={(e) => setStoreLat(e.target.value)} required placeholder="35.6812" />
            </div>
            <div className="form-group">
              <label>経度</label>
              <input type="number" step="any" value={storeLng} onChange={(e) => setStoreLng(e.target.value)} required placeholder="139.7671" />
            </div>
            <div className="form-group">
              <label>許容半径（m）</label>
              <input type="number" value={storeRadius} onChange={(e) => setStoreRadius(e.target.value)} min="10" max="5000" required />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleGetCurrentLocation} className="btn btn-secondary" disabled={gettingLocation}>
              {gettingLocation ? '取得中...' : '現在地を設定'}
            </button>
            <button type="submit" className="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
