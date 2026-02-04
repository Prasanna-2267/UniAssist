import React, { createContext, useContext, useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*                                 USER TYPE                                  */
/* -------------------------------------------------------------------------- */
interface User {
  email: string;
  name: string;
  role: string;               // student | advisor | hod | warden
  reg_no?: string;            // only students
  residence_type?: string;    // HOSTEL | DAY_SCHOLAR (only students)
}

/* -------------------------------------------------------------------------- */
/*                              CONTEXT TYPE                                  */
/* -------------------------------------------------------------------------- */
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: (googleToken: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/* -------------------------------------------------------------------------- */
/*                             PROVIDER                                       */
/* -------------------------------------------------------------------------- */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* ------------------------ LOAD USER FROM STORAGE ------------------------ */
  useEffect(() => {
    const storedUser = localStorage.getItem("college_user");
    const token = localStorage.getItem("college_token");

    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }

    setIsLoading(false);
  }, []);

  /* --------------------------- GOOGLE LOGIN ------------------------------- */
  const loginWithGoogle = async (googleToken: string): Promise<User> => {
    const res = await fetch("http://localhost:8000/auth/google-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: googleToken }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      let message = "Authentication failed";

      if (typeof data?.detail === "string") message = data.detail;
      else if (Array.isArray(data?.detail)) message = data.detail.map((e: any) => e.msg).join(", ");

      throw new Error(message);
    }

    const loggedInUser: User = {
      email: data.email,
      name: data.name,
      role: data.role.toLowerCase(),
      reg_no: data.reg_no ?? undefined,
      residence_type: data.residence_type ?? undefined,
    };

    localStorage.setItem("college_token", data.access_token);
    localStorage.setItem("college_user", JSON.stringify(loggedInUser));

    setUser(loggedInUser);
    return loggedInUser;
  };

  /* ------------------------------ LOGOUT ---------------------------------- */
  const logout = () => {
    localStorage.removeItem("college_token");
    localStorage.removeItem("college_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* -------------------------------------------------------------------------- */
/*                                HOOK                                        */
/* -------------------------------------------------------------------------- */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
