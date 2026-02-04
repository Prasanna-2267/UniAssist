import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null; // wait until auth loads

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}
