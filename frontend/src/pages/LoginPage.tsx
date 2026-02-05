import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (response: any) => {
    try {
      if (!response?.credential) throw new Error("No Google token received");

      // 🔐 Send Google token to backend → receive JWT + user
      const user = await loginWithGoogle(response.credential);

      const role = user?.role?.toLowerCase();

      // 🚀 Role-based routing
      switch (role) {
        case "student":
          navigate("/student");
          break;
        case "advisor":
          navigate("/advisor");
          break;
        case "hod":
          navigate("/hod");
          break;
        case "warden":
          navigate("/warden");
          break;
        case "dept-incharge":
          navigate("/dept-incharge");
          break;
        default:
          navigate("/");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Use college email.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="text-center shadow-lg">
          <CardHeader>
            <div className="mx-auto mb-4 flex items-center justify-center">
  <img
    src="/src/assets/logo.png"
    alt="College Logo"
    className="h-14 w-14 object-contain"
  />
</div>

            <CardTitle className="text-2xl">College Request Portal</CardTitle>
            <CardDescription>
              Sign in with your college Google account to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => alert("Google Login Failed")}
              useOneTap={false} // keeps flow stable in dev
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
