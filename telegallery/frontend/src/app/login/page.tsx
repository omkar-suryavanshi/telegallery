"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

type Step = "phone" | "code" | "password";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { loginToken } = await api.auth.login(phone);
      setLoginToken(loginToken);
      setStep("code");
    } catch (err: any) {
      setError(err.message ?? "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginToken) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.auth.verify({ loginToken, code });
      if (result.requires2FA) {
        setStep("password");
      } else if (result.success) {
        router.push("/dashboard/gallery");
      }
    } catch (err: any) {
      setError(err.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginToken) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.auth.verify({ loginToken, password });
      if (result.success) router.push("/dashboard/gallery");
    } catch (err: any) {
      setError(err.message ?? "Incorrect password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-md rounded-xl2 p-8"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-xl font-semibold">TeleGallery</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sign in with your Telegram account
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "phone" && (
            <motion.form
              key="phone"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              onSubmit={handlePhoneSubmit}
              className="space-y-4"
            >
              <label className="block text-sm font-medium">Phone number</label>
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 px-3 py-2.5">
                <Phone className="h-4 w-4 text-neutral-400" />
                <input
                  type="tel"
                  required
                  placeholder="+1 555 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
              <SubmitButton loading={loading} label="Send code" />
            </motion.form>
          )}

          {step === "code" && (
            <motion.form
              key="code"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              onSubmit={handleCodeSubmit}
              className="space-y-4"
            >
              <label className="block text-sm font-medium">Verification code</label>
              <p className="text-xs text-neutral-500">
                Telegram sent a login code to {phone} — check the Telegram app.
              </p>
              <input
                type="text"
                required
                inputMode="numeric"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 px-3 py-2.5 text-sm outline-none tracking-widest"
              />
              <SubmitButton loading={loading} label="Verify" />
            </motion.form>
          )}

          {step === "password" && (
            <motion.form
              key="password"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              onSubmit={handlePasswordSubmit}
              className="space-y-4"
            >
              <label className="block text-sm font-medium">Two-factor password</label>
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-800/60 px-3 py-2.5">
                <KeyRound className="h-4 w-4 text-neutral-400" />
                <input
                  type="password"
                  required
                  placeholder="Cloud password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
              <SubmitButton loading={loading} label="Sign in" />
            </motion.form>
          )}
        </AnimatePresence>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </motion.div>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}
