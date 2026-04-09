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
  const [storeLocation, setStoreLocation] = useState(null);
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchToday();
    fetchStoreLocation();
    watchPosition();
  }, []);

  const fetchStoreLocation = async () => {
    try {
      const res = await api.get('/store-location');
      setStoreLocation(res.data.location);
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
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    });

    navigator.geolocation.watchPosition(updatePosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    });
  };

  useEffect(() => {
    if (position && storeLocation) {
      const d = haversineDistance(
        position.latitude, position.longitude,
        storeLocation.latitude, storeLocation.longitude
      );
      setDistance(Math.round(d));
    } else {
      setDistance(null);
    }
  }, [position, storeLocation]);

  const fetchToday = async () => {
    try {
      const res = await api.get('/attendance/today');
      setTodayRecord(res.data.record);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const body = {};
      if (position) {
        body.latitude = position.latitude;
        body.longitude = position.longitude;
      }
      const res = await api.post('/attendance/clock-in', body);
      setMessage(res.data.message);
      fetchToday();
    } catch (err) {
      setError(err.response?.data?.error || '打刻に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const body = {};
      if (position) {
        body.latitude = position.latitude;
        body.longitude = position.longitude;
      }
      const res = await api.post('/attendance/clock-out', body);
      setMessage(res.data.message);
      fetchToday();
    } catch (err) {
      setError(err.response?.data?.error || '打刻に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };

  const hasClockedIn = todayRecord?.clock_in;
  const hasClockedOut = todayRecord?.clock_out;
  const isInRange = storeLocation ? (distance !== null && distance <= storeLocation.radius) : true;

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
          {storeLocation && distance !== null && (
            <div className={`gps-distance ${isInRange ? 'in-range' : 'out-of-range'}`}>
              {storeLocation.name}まで: {distance}m
              {isInRange
                ? ` (範囲内 - ${storeLocation.radius}m以内)`
                : ` (範囲外 - ${storeLocation.radius}m以内で打刻可能)`
              }
            </div>
          )}
          {!storeLocation && (
            <div className="gps-distance neutral">店舗位置が未設定（位置制限なし）</div>
          )}
        </div>

        <div className="stamp-status">
          <div className="status-item">
            <span className="status-label">出勤</span>
            <span className="status-value">{hasClockedIn || '--:--:--'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">退勤</span>
            <span className="status-value">{hasClockedOut || '--:--:--'}</span>
          </div>
        </div>

        <div className="stamp-buttons">
          <button
            onClick={handleClockIn}
            className="btn btn-clock-in"
            disabled={loading || hasClockedIn || (!isInRange && storeLocation)}
          >
            出勤
          </button>
          <button
            onClick={handleClockOut}
            className="btn btn-clock-out"
            disabled={loading || !hasClockedIn || hasClockedOut || (!isInRange && storeLocation)}
          >
            退勤
          </button>
        </div>
      </div>
    </div>
  );
}
