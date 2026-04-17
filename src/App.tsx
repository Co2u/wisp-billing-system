/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Subscribers from './pages/Subscribers';
import Invoices from './pages/Invoices';
import Plans from './pages/Plans';
import Routers from './pages/Routers';
import Login from './pages/Login';
import Layout from './components/Layout';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setIsAuthenticated(true);

    const handleUnauthorized = () => {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, []);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <BrowserRouter>
      <Layout onLogout={() => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/subscribers" element={<Subscribers />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/routers" element={<Routers />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
