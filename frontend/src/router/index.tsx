import React, { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import {
  ProtectedRoute,
  GuardOnlyRoute,
  AdminOnlyRoute,
} from './guards';

// Lazy-loaded routes per user requirements
const MapPage = lazy(() => import('../pages/MapPage'));
const LotDetails = lazy(() => import('../pages/LotDetails'));
const BookingConfirmation = lazy(() => import('../pages/BookingConfirmation'));
const MyBookings = lazy(() => import('../pages/MyBookings'));
const Profile = lazy(() => import('../pages/Profile'));
const Login = lazy(() => import('../pages/Login'));
const Signup = lazy(() => import('../pages/Signup'));
const NotFound = lazy(() => import('../pages/NotFound'));

// Teammate Mount Points (Member 1 per C9)
const GuardRoutes = lazy(() => import('../features/guard/GuardRoutes'));
const AdminRoutes = lazy(() => import('../features/admin/AdminRoutes'));

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public Routes */}
        <Route path="/" element={<MapPage />} />
        <Route path="/lots/:id" element={<LotDetails />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* User Protected Routes */}
        <Route
          path="/booking/confirm/:bookingId"
          element={
            <ProtectedRoute>
              <BookingConfirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Guard Role Protected Routes (Member 1) */}
        <Route
          path="/guard/*"
          element={
            <GuardOnlyRoute>
              <GuardRoutes />
            </GuardOnlyRoute>
          }
        />

        {/* Admin Role Protected Routes (Member 1) */}
        <Route
          path="/admin/*"
          element={
            <AdminOnlyRoute>
              <AdminRoutes />
            </AdminOnlyRoute>
          }
        />

        {/* Catch-all 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};
