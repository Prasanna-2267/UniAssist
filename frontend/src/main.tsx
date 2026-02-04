import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
createRoot(document.getElementById("root")!).render(
 <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>        {/* ✅ ONLY HERE */}
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
</GoogleOAuthProvider>

);
