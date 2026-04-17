import { useState, useEffect } from 'react';
import api from '../api';

export default function AdminPage() {
  // スタッフ
  const [staffList, setStaffList] = useState([]);
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [newStaffStores, setNewStaffStores] = useState([]); // 新規スタッフの所属店舗
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 店舗
  const [stores, setStores] = useState([]);
  const [storeForm, setStoreForm] = useState({ id: null, name: '', latitude: '', longitude: '', radius: '200' });
  const [storeError, setStoreError] = useState('');
  const [storeSuccess, setStoreSuccess] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);

  // 所属店舗編集モーダル
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingStoreIds, setEditingStoreIds] = useState([]);

  // 本日の勤怠
  const [todayRecords, setTodayRecords] = useState([]);
  const [todayAllStaff, setTodayAllStaff] = useState([]);
  const [todayDate, setTodayDate] = useState('');

  useEffect(() => {
    fetchStaff();
    fetchStores();
    fetchTodayAll();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff');
      setStaffList(res.data.staff);
    } catch (err) { console.error(err); }
  };

  const fetchStores = async () => {
    try {
      const res = await api.get('/stores');
      setStores(res.data.stores);
    } catch (err) { console.error(err); }
  };

  const fetchTodayAll = async () => {
    try {
      const res = await api.get('/attendance/today-all');
      setTodayRecords(res.data.records);
      setTodayAllStaff(res.data.allStaff);
      setTodayDate(res.data.date);
    } catch (err) { console.error(err); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.post('/staff', {
        name, login_id: loginId, password, role,
        store_ids: newStaffStores
      });
      setSuccess('スタッフを追加しました');
      setName(''); setLoginId(''); setPassword(''); setRole('staff'); setNewStaffStores([]);
      fetchStaff();
    } catch (err) {
      setError(err.response?.data?.error || '追加に失敗しました');
    }
  };

  const handleDelete = async (id, staffName) => {
    if (!window.confirm(`${staffName}を削除しますか？関連する勤怠データもすべて削除されます。`)) return;
    setError(''); setSuccess('');
    try {
      await api.delete(`/staff/${id}`);
      setSuccess('スタッフを削除しました');
      fetchStaff();
    } catch (err) {
      setError(err.response?.data?.error || '削除に失敗しました');
    }
  };

  const openEditStores = (staff) => {
    setEditingStaff(staff);
    setEditingStoreIds(staff.stores ? staff.stores.map(s => s.id) : []);
  };

  const saveEditStores = async () => {
    try {
      await api.put(`/staff/${editingStaff.id}/stores`, { store_ids: editingStoreIds });
      setSuccess('所属店舗を更新しました');
      setEditingStaff(null);
      fetchStaff();
    } catch (err) {
      setError(err.response?.data?.error || '更新に失敗しました');
    }
  };

  const toggleStoreInList = (list, setList, storeId) => {
    if (list.includes(storeId)) setList(list.filter(id => id !== storeId));
    else setList([...list, storeId]);
  };

  // 店舗管理
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStoreError('このブラウザはGPSに対応していません'); return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStoreForm({ ...storeForm, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) });
        setGettingLocation(false);
      },
      () => { setStoreError('位置情報の取得に失敗しました'); setGettingLocation(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveStore = async (e) => {
    e.preventDefault();
    setStoreError(''); setStoreSuccess('');
    try {
      const body = {
        name: storeForm.name,
        latitude: parseFloat(storeForm.latitude),
        longitude: parseFloat(storeForm.longitude),
        radius: parseInt(storeForm.radius, 10)
      };
      if (storeForm.id) {
        await api.put(`/stores/${storeForm.id}`, body);
        setStoreSuccess('店舗を更新しました');
      } else {
        await api.post('/stores', body);
        setStoreSuccess('店舗を追加しました');
      }
      setStoreForm({ id: null, name: '', latitude: '', longitude: '', radius: '200' });
      fetchStores();
    } catch (err) {
      setStoreError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const editStore = (store) => {
    setStoreForm({
      id: store.id,
      name: store.name,
      latitude: String(store.latitude),
      longitude: String(store.longitude),
      radius: String(store.radius)
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const deleteStore = async (store) => {
    if (!window.confirm(`「${store.name}」を削除しますか？所属スタッフからもこの店舗が外されます。`)) return;
    try {
      await api.delete(`/stores/${store.id}`);
      setStoreSuccess('店舗を削除しました');
      fetchStores();
      fetchStaff();
    } catch (err) {
      setStoreError(err.response?.data?.error || '削除に失敗しました');
    }
  };

  const cancelEdit = () => {
    setStoreForm({ id: null, name: '', latitude: '', longitude: '', radius: '200' });
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
          {stores.length > 0 && (
            <div className="form-group" style={{marginTop:'12px'}}>
              <label>所属店舗（複数選択可）</label>
              <div className="checkbox-group">
                {stores.map(s => (
                  <label key={s.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={newStaffStores.includes(s.id)}
                      onChange={() => toggleStoreInList(newStaffStores, setNewStaffStores, s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
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
                <th>所属店舗</th>
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
                  <td>
                    {s.stores && s.stores.length > 0
                      ? s.stores.map(st => st.name).join(', ')
                      : <span style={{color:'#888'}}>未設定</span>}
                  </td>
                  <td>{s.created_at}</td>
                  <td>
                    <button onClick={() => openEditStores(s)} className="btn btn-secondary btn-sm" style={{marginRight:'4px'}}>
                      店舗編集
                    </button>
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
        <h3>店舗管理</h3>
        <p className="section-desc">複数の店舗を登録できます。各店舗ごとに位置と許容範囲を設定し、所属スタッフは自分の店舗の範囲内でのみ打刻できます。</p>

        <div className="table-wrapper" style={{marginBottom:'16px'}}>
          <table className="staff-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>店舗名</th>
                <th>緯度</th>
                <th>経度</th>
                <th>半径(m)</th>
                <th>地図</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td><strong>{s.name}</strong></td>
                  <td>{Number(s.latitude).toFixed(6)}</td>
                  <td>{Number(s.longitude).toFixed(6)}</td>
                  <td>{s.radius}</td>
                  <td>
                    <a href={makeMapUrl(s.latitude, s.longitude)} target="_blank" rel="noopener noreferrer" className="loc-link">MAP</a>
                  </td>
                  <td>
                    <button onClick={() => editStore(s)} className="btn btn-secondary btn-sm" style={{marginRight:'4px'}}>編集</button>
                    <button onClick={() => deleteStore(s)} className="btn btn-danger btn-sm">削除</button>
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr><td colSpan="7" style={{textAlign:'center',color:'#888'}}>店舗が登録されていません</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h4 style={{marginTop:'24px',marginBottom:'12px',fontSize:'14px',color:'#444'}}>
          {storeForm.id ? `店舗編集（ID: ${storeForm.id}）` : '新しい店舗を追加'}
        </h4>

        {storeError && <div className="error-msg">{storeError}</div>}
        {storeSuccess && <div className="success-msg">{storeSuccess}</div>}

        <form onSubmit={handleSaveStore} className="admin-form">
          <div className="form-row">
            <div className="form-group">
              <label>店舗名</label>
              <input type="text" value={storeForm.name} onChange={(e) => setStoreForm({...storeForm, name: e.target.value})} required placeholder="例: 渋谷店" />
            </div>
            <div className="form-group">
              <label>緯度</label>
              <input type="number" step="any" value={storeForm.latitude} onChange={(e) => setStoreForm({...storeForm, latitude: e.target.value})} required placeholder="35.6812" />
            </div>
            <div className="form-group">
              <label>経度</label>
              <input type="number" step="any" value={storeForm.longitude} onChange={(e) => setStoreForm({...storeForm, longitude: e.target.value})} required placeholder="139.7671" />
            </div>
            <div className="form-group">
              <label>許容半径（m）</label>
              <input type="number" value={storeForm.radius} onChange={(e) => setStoreForm({...storeForm, radius: e.target.value})} min="10" max="5000" required />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleGetCurrentLocation} className="btn btn-secondary" disabled={gettingLocation}>
              {gettingLocation ? '取得中...' : '現在地を設定'}
            </button>
            <button type="submit" className="btn btn-primary">{storeForm.id ? '更新' : '追加'}</button>
            {storeForm.id && (
              <button type="button" onClick={cancelEdit} className="btn btn-sm">キャンセル</button>
            )}
          </div>
        </form>
      </div>

      {/* 所属店舗編集モーダル */}
      {editingStaff && (
        <div className="modal-overlay" onClick={() => setEditingStaff(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingStaff.name} の所属店舗</h3>
            {stores.length === 0 ? (
              <p>先に店舗を登録してください。</p>
            ) : (
              <div className="checkbox-group">
                {stores.map(s => (
                  <label key={s.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={editingStoreIds.includes(s.id)}
                      onChange={() => toggleStoreInList(editingStoreIds, setEditingStoreIds, s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
            <div className="form-actions" style={{marginTop:'16px'}}>
              <button onClick={() => setEditingStaff(null)} className="btn btn-sm">キャンセル</button>
              <button onClick={saveEditStores} className="btn btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
