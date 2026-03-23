"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { registerSchema, type RegisterSchema } from "@/lib/validations";
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

    .reg-card { animation: cardIn 0.35s ease-out both; }
    .reg-err  { animation: errIn 0.2s ease-out both; }
    .reg-ferr { animation: errIn 0.15s ease-out both; }
  }

  .reg-input {
    width:100%; background:#2A2320; color:#EDE6DD;
    border:1px solid rgba(196,112,75,0.15);
    border-radius:8px; padding:0.75rem 1rem; font-size:0.9rem;
    outline:none; transition:border-color 0.2s ease; box-sizing:border-box;
  }
  .reg-input::placeholder { color:rgba(168,155,140,0.5); }
  .reg-input:focus { border-color:rgba(196,112,75,0.4); }
  .reg-input.has-error { border-color:rgba(168,84,68,0.5); }

  .reg-btn-submit {
    width:100%; background:#EDE6DD; color:#171311;
    border:none; border-radius:8px;
    padding:0.8rem 1rem; font-size:0.95rem; font-weight:600;
    cursor:pointer; transition:transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }
  .reg-btn-submit:hover:not(:disabled) { transform:scale(1.01); box-shadow:0 0 22px rgba(196,112,75,0.35); }
  .reg-btn-submit:active:not(:disabled) { transform:scale(0.99); }
  .reg-btn-submit:disabled { opacity:0.7; cursor:not-allowed; }

  .reg-role-btn {
    flex:1; padding:0.6rem; font-size:0.9rem; font-weight:500;
    border-radius:8px; cursor:pointer;
    transition:background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    border:1px solid rgba(196,112,75,0.15); background:#2A2320; color:#A89B8C;
  }
  .reg-role-btn.active {
    background:rgba(196,112,75,0.18); border-color:#C4704B; color:#EDE6DD;
  }

  .reg-spinner {
    display:inline-block; width:14px; height:14px;
    border:2px solid rgba(23,19,17,0.25); border-top-color:#171311;
    border-radius:50%; margin-right:8px; vertical-align:middle;
    animation:spinR 1s linear infinite;
  }
`;

// ─── Register Form ────────────────────────────────────────────────────────────
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    defaultValues: { role: "INVESTOR", name: "", email: "", password: "" },
  });

  const role = watch("role");

  async function onSubmit(data: RegisterSchema) {
    setServerError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name || undefined,
          role: data.role,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setServerError(err.error ?? "Registration failed. Please try again.");
        return;
      }

      const signInRes = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (signInRes?.error) {
        setServerError("Account created — please sign in manually.");
        router.push("/login");
        return;
      }

      router.push(callbackUrl ?? "/dashboard");
    } catch {
      setServerError("Something went wrong. Please try again.");
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
        <div className="reg-card" style={{
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
            Create account
          </h1>
          <p style={{ color:"#A89B8C", fontSize:"0.875rem", margin:"0 0 1.75rem" }}>
            Join MilestoneFund
          </p>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

            {/* Role */}
            <div>
              <label style={{ color:"#EDE6DD", fontSize:"0.875rem", fontWeight:500, display:"block", marginBottom:"0.5rem" }}>
                I am a…
              </label>
              <div style={{ display:"flex", gap:"0.5rem" }}>
                <button type="button" onClick={() => setValue("role","INVESTOR")} className={`reg-role-btn${role==="INVESTOR"?" active":""}`}>
                  Investor
                </button>
                <button type="button" onClick={() => setValue("role","STARTUP")} className={`reg-role-btn${role==="STARTUP"?" active":""}`}>
                  Startup
                </button>
              </div>
              <input type="hidden" {...register("role")} />
            </div>

            {/* Name */}
            <div>
              <label style={{ color:"#EDE6DD", fontSize:"0.875rem", fontWeight:500, display:"block", marginBottom:"0.5rem" }}>
                Name (optional)
              </label>
              <input type="text" placeholder="Your name or company" className={`reg-input${errors.name?" has-error":""}`} {...register("name")} />
              {errors.name && <p className="reg-ferr" style={{ color:"#A85444", fontSize:"0.75rem", margin:"0.3rem 0 0" }}>{errors.name.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label style={{ color:"#EDE6DD", fontSize:"0.875rem", fontWeight:500, display:"block", marginBottom:"0.5rem" }}>
                Email
              </label>
              <input type="email" placeholder="you@example.com" className={`reg-input${errors.email?" has-error":""}`} {...register("email")} />
              {errors.email && <p className="reg-ferr" style={{ color:"#A85444", fontSize:"0.75rem", margin:"0.3rem 0 0" }}>{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label style={{ color:"#EDE6DD", fontSize:"0.875rem", fontWeight:500, display:"block", marginBottom:"0.5rem" }}>
                Password
              </label>
              <input type="password" placeholder="Min. 8 characters" className={`reg-input${errors.password?" has-error":""}`} {...register("password")} />
              {errors.password && <p className="reg-ferr" style={{ color:"#A85444", fontSize:"0.75rem", margin:"0.3rem 0 0" }}>{errors.password.message}</p>}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="reg-err" style={{
                background:"rgba(168,84,68,0.10)",
                border:"1px solid rgba(168,84,68,0.22)",
                borderRadius:"8px", padding:"0.75rem 1rem",
              }}>
                <p style={{ color:"#A85444", fontSize:"0.875rem", margin:0 }}>{serverError}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={isSubmitting} className="reg-btn-submit">
              {isSubmitting
                ? <><span className="reg-spinner" />Creating account…</>
                : "Create account"
              }
            </button>
          </form>

          <p style={{ textAlign:"center", fontSize:"0.875rem", color:"#A89B8C", marginTop:"1.5rem", marginBottom:0 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color:"#C4704B", fontWeight:500, textDecoration:"none" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
