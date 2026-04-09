import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import StampPage from './pages/StampPage';
import MonthlyPage from './pages/MonthlyPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const { user } = useAuth();

  return (
    <div className="app">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute><StampPage /></ProtectedRoute>
          } />
          <Route path="/monthly" element={
            <ProtectedRoute><MonthlyPage /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
