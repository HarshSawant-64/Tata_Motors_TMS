import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Programs from './pages/Programs';
import Scheduling from './pages/Scheduling';
import SessionDetails from './pages/SessionDetails';
import Faculty from './pages/Faculty';
import Employees from './pages/Employees';
import EmployeeProfile from './pages/EmployeeProfile';
import Analytics from './pages/Analytics';
import Uploads from './pages/Uploads';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/programs" element={<ProtectedRoute><Programs /></ProtectedRoute>} />
          <Route path="/scheduling" element={<ProtectedRoute><Scheduling /></ProtectedRoute>} />
          <Route path="/sessions/:id" element={<ProtectedRoute><SessionDetails /></ProtectedRoute>} />
          <Route path="/faculty" element={<ProtectedRoute><Faculty /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
          <Route path="/employees/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/uploads" element={<ProtectedRoute><Uploads /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
