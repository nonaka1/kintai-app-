import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StampPage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('取得中...');
  const [position, setPosition] = useState(null);
  const [stores, setStores] = useState([]);
  const [closest, setClosest] = useState(null); // { store, distance }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchToday();
    fetchStores();
    watchPosition();
  }, []);

  const fetchStores = async () => {
    try {
      const res = await api.get('/stores');
      setStores(res.data.stores || []);
    } catch (err) {
      console.error(err);
    }
  };

  const watchPosition = () => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS非対応');
      return;
    }
    const updatePosition = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setPosition({ latitude, longitude, accuracy });
      setGpsStatus(`取得済み（精度: ${Math.round(accuracy)}m）`);
    };
    const handleError = (err) => {
      if (err.code === 1) setGpsStatus('位置情報の許可が必要です');
      else if (err.code === 2) setGpsStatus('位置情報を取得できません');
      else setGpsStatus('位置情報の取得がタイムアウトしました');
    };
    navigator.geolocation.getCurrentPosition(updatePosition, handleError, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 30000
    });
    navigator.geolocation.watchPosition(updatePosition, handleError, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 30000
    });
  };

  // 最も近い店舗と距離を計算
  useEffect(() => {
    if (!position || stores.length === 0) {
      setClosest(null);
      return;
    }
    let best = null;
    for (const s of stores) {
      const d = haversineDistance(position.latitude, position.longitude, s.latitude, s.longitude);
      if (!best || d < best.distance) best = { store: s, distance: Math.round(d) };
    }
    setClosest(best);
  }, [position, stores]);

  const fetchToday = async () => {
    try {
      const res = await api.get('/attendance/today');
      setTodayRecord(res.data.record);
    } catch (err) { console.error(err); }
  };

  const handleAction = async (endpoint) => {
    setLoading(true);
    setMessage(''); setError('');
    try {
      const body = {};
      if (position) {
        body.latitude = position.latitude;
        body.longitude = position.longitude;
      }
      const res = await api.post(`/attendance/${endpoint}`, body);
      setMessage(res.data.message);
      fetchToday();
    } catch (err) {
      setError(err.response?.data?.error || '打刻に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date) => date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const hasClockedIn = todayRecord?.clock_in;
  const hasClockedOut = todayRecord?.clock_out;
  const isOnBreak = todayRecord?.break_start && !todayRecord?.break_end;
  // 所属店舗がない場合は制限なし。あれば最も近い店舗の半径内にあればOK
  const hasStores = stores.length > 0;
  const isInRange = !hasStores || (closest && closest.distance <= closest.store.radius);

  return (
    <div className="stamp-container">
      <div className="stamp-card">
        <p className="stamp-greeting">おはようございます、{user.name}さん</p>
        <p className="stamp-date">{formatDate(currentTime)}</p>
        <p className="stamp-time">{formatTime(currentTime)}</p>

        {message && <div className="success-msg">{message}</div>}
        {error && <div className="error-msg">{error}</div>}

        <div className="gps-info">
          <div className="gps-status">
            <span className={`gps-dot ${position ? 'active' : 'inactive'}`}></span>
            GPS: {gpsStatus}
          </div>
          {hasStores && closest && (
            <div className={`gps-distance ${isInRange ? 'in-range' : 'out-of-range'}`}>
              最寄り店舗「{closest.store.name}」まで: {closest.distance}m
              {isInRange ? `（範囲内）` : `（範囲外 - ${closest.store.radius}m以内で打刻可能）`}
            </div>
          )}
          {hasStores && stores.length > 1 && (
            <div className="gps-distance neutral" style={{fontSize:'12px',marginTop:'4px'}}>
              所属店舗: {stores.map(s => s.name).join(' / ')}
            </div>
          )}
          {!hasStores && (
            <div className="gps-distance neutral">所属店舗が未設定（位置制限なし）</div>
          )}
        </div>

        <div className="stamp-status">
          <div className="status-item">
            <span className="status-label">出勤</span>
            <span className="status-value">{hasClockedIn || '--:--:--'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">休憩</span>
            <span className="status-value">{todayRecord?.break_start || '--:--:--'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">戻り</span>
            <span className="status-value">{todayRecord?.break_end || '--:--:--'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">退勤</span>
            <span className="status-value">{hasClockedOut || '--:--:--'}</span>
          </div>
        </div>

        <div className="stamp-buttons">
          <button
            onClick={() => handleAction('clock-in')}
            className="btn btn-clock-in"
            disabled={loading || hasClockedIn || !isInRange}
          >
            出勤
          </button>
          <button
            onClick={() => handleAction('break-start')}
            className="btn btn-break-start"
            disabled={loading || !hasClockedIn || hasClockedOut || isOnBreak || !isInRange}
          >
            休憩
          </button>
          <button
            onClick={() => handleAction('break-end')}
            className="btn btn-break-end"
            disabled={loading || !isOnBreak}
          >
            戻り
          </button>
          <button
            onClick={() => handleAction('clock-out')}
            className="btn btn-clock-out"
            disabled={loading || !hasClockedIn || hasClockedOut || isOnBreak || !isInRange}
          >
            退勤
          </button>
        </div>
      </div>
    </div>
  );
}
