import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">勤怠管理</h1>
        <nav className="header-nav">
          <Link to="/">打刻</Link>
          <Link to="/monthly">月次一覧</Link>
          {user.role === 'admin' && <Link to="/admin">管理</Link>}
        </nav>
      </div>
      <div className="header-right">
        <span className="header-user">{user.name}（{user.role === 'admin' ? '管理者' : 'スタッフ'}）</span>
        <button onClick={handleLogout} className="btn btn-logout">ログアウト</button>
      </div>
    </header>
  );
}
