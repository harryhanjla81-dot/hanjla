import React from 'react';
// Using named import for Navigate from react-router-dom to resolve module export error.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../src/contexts/AuthContext.tsx';
import Spinner from './Spinner.tsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
