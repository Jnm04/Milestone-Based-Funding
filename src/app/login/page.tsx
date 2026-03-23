"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginSchema, type LoginSchema } from "@/lib/validations";
import NetworkBackground from "@/components/shared/NetworkBackground";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @media (prefers-reduced-motion: no-preference) {
    @keyframes cardIn {
      from { opacity:0; transform:translateY(16px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes errIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spinR { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

    .log-card { animation: cardIn 0.35s ease-out both; }
    .log-err  { animation: errIn 0.2s ease-out both; }
    .log-ferr { animation: errIn 0.15s ease-out both; }
  }

  .log-input {
    width:100%; background:#2A2320; color:#EDE6DD;
    border:1px solid rgba(196,112,75,0.15);
    border-radius:8px; padding:0.75rem 1rem; font-size:0.9rem;
    outline:none; transition:border-color 0.2s ease; box-sizing:border-box;
  }
  .log-input::placeholder { color:rgba(168,155,140,0.5); }
  .log-input:focus { border-color:rgba(196,112,75,0.4); }
  .log-input.has-error { border-color:rgba(168,84,68,0.5); }

  .log-btn-submit {
    width:100%; background:#EDE6DD; color:#171311;
    border:none; border-radius:8px;
    padding:0.8rem 1rem; font-size:0.95rem; font-weight:600;
    cursor:pointer; transition:transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }
  .log-btn-submit:hover:not(:disabled) { transform:scale(1.01); box-shadow:0 0 22px rgba(196,112,75,0.35); }
  .log-btn-submit:active:not(:disabled) { transform:scale(0.99); }
  .log-btn-submit:disabled { opacity:0.7; cursor:not-allowed; }

  .log-spinner {
    display:inline-block; width:14px; height:14px;
    border:2px solid rgba(23,19,17,0.25); border-top-color:#171311;
    border-radius:50%; margin-right:8px; vertical-align:middle;
    animation:spinR 1s linear infinite;
  }
`;

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  async function onSubmit(data: LoginSchema) {
    setServerError("");
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError("Invalid email or password. Please try again.");
      return;
    }

    if (result?.ok) {
      router.push(callbackUrl ?? "/dashboard");
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        minHeight:"100vh", background:"#171311",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"1.5rem", position:"relative",
      }}>
        <NetworkBackground density="low" interactive={true} />

        {/* Card */}
        <div className="log-card" style={{
          position:"relative", zIndex:1,
          width:"100%", maxWidth:"440px",
          background:"#221C18", borderRadius:"16px",
          border:"1px solid rgba(196,112,75,0.10)",
          boxShadow:"0 0 40px rgba(196,112,75,0.06), 0 8px 32px rgba(0,0,0,0.4)",
          padding:"2rem",
        }}>
          {/* Logo */}
          <Link href="/" style={{
            fontWeight:700, fontSize:"1.05rem", color:"#C4704B",
            textDecoration:"none", display:"block", marginBottom:"1.25rem",
          }}>
            MilestoneFund
          </Link>

          <h1 style={{ fontWeight:700, fontSize:"1.6rem", color:"#EDE6DD", margin:"0 0 0.25rem", letterSpacing:"-0.02em" }}>
            Sign in
          </h1>
          <p style={{ color:"#A89B8C", fontSize:"0.875rem", margin:"0 0 1.75rem" }}>
            Welcome back
          </p>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

            {/* Email */}
            <div>
              <label style={{ color:"#EDE6DD", fontSize:"0.875rem", fontWeight:500, display:"block", marginBottom:"0.5rem" }}>
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className={`log-input${errors.email ? " has-error" : ""}`}
                {...register("email")}
              />
              {errors.email && (
                <p className="log-ferr" style={{ color:"#A85444", fontSize:"0.75rem", margin:"0.3rem 0 0" }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label style={{ color:"#EDE6DD", fontSize:"0.875rem", fontWeight:500, display:"block", marginBottom:"0.5rem" }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                className={`log-input${errors.password ? " has-error" : ""}`}
                {...register("password")}
              />
              {errors.password && (
                <p className="log-ferr" style={{ color:"#A85444", fontSize:"0.75rem", margin:"0.3rem 0 0" }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="log-err" style={{
                background:"rgba(168,84,68,0.10)",
                border:"1px solid rgba(168,84,68,0.22)",
                borderRadius:"8px", padding:"0.75rem 1rem",
              }}>
                <p style={{ color:"#A85444", fontSize:"0.875rem", margin:0 }}>{serverError}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isSubmitting} className="log-btn-submit">
              {isSubmitting
                ? <><span className="log-spinner" />Signing in…</>
                : "Sign in"
              }
            </button>
          </form>

          <p style={{ textAlign:"center", fontSize:"0.875rem", color:"#A89B8C", marginTop:"1.5rem", marginBottom:0 }}>
            No account?{" "}
            <Link
              href={callbackUrl ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"}
              style={{ color:"#C4704B", fontWeight:500, textDecoration:"none" }}
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
