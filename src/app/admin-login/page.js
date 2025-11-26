// src/app/admin-login/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });

  const router = useRouter();

  const handleLogin = (e) => {
    e.preventDefault();

    if (credentials.username === "sahaya" && credentials.password === "Babu@1234") {
      localStorage.setItem("isAdmin", "true");
      router.push("/admin/dashboard");
    } else {
      alert("❌ Invalid username or password");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--background)" }}>
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-gradient-to-r from-indigo-100 via-blue-300 to-indigo-100 rounded-2xl p-6 sm:p-8 shadow-xl transform transition-all hover:-translate-y-0.5"
      >
        <h1 className="text-2xl font-bold text-center text-red-800 mb-6">Admin Login</h1>

        <input
          type="text"
          placeholder="Username"
          value={credentials.username}
          onChange={(e) =>
            setCredentials({ ...credentials, username: e.target.value })
          }
          className="w-full p-3 rounded mb-4 bg-white/90 border border-indigo-700 text-black"
        />

        <input
          type="password"
          placeholder="Password"
          value={credentials.password}
          onChange={(e) =>
            setCredentials({ ...credentials, password: e.target.value })
          }
          className="w-full p-3 rounded mb-4 bg-white/90 border border-indigo-700 text-black"
        />

        <button
          type="submit"
          className="w-full bg-blue-900 hover:bg-green-900 py-2 rounded font-semibold transition-all hover:shadow-lg"
        >
          Login
        </button>
      </form>
    </main>
  );
}
