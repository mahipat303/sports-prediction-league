"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, MailCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerUser, verifyEmail, resendVerificationCode } from "@/app/actions";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    setEmail(String(formData.get("email")));
    setPassword(String(formData.get("password")));
    const result = await registerUser(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setStep("verify");
    setInfo("We emailed you a 6-digit code.");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("code", code);
    const result = await verifyEmail(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    // Verified — sign straight in
    await signIn("credentials", { email, password, redirect: false });
    router.push("/");
    router.refresh();
  }

  async function handleResend() {
    setError(null);
    const formData = new FormData();
    formData.set("email", email);
    const result = await resendVerificationCode(formData);
    setInfo(result?.error ?? "New code sent — check your inbox.");
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-sm">
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-lg">
            {step === "form" ? <Sparkles className="h-6 w-6" /> : <MailCheck className="h-6 w-6" />}
          </span>
          <CardTitle className="text-xl">
            {step === "form" ? "Join the league" : "Check your email"}
          </CardTitle>
          <CardDescription>
            {step === "form"
              ? "Register with your @opshub.com office email"
              : `Enter the 6-digit code we sent to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "form" ? (
            <form onSubmit={handleRegister} className="space-y-3">
              <Input name="name" placeholder="Your name" required minLength={2} />
              <Input
                name="email"
                type="email"
                placeholder="you@opshub.com"
                pattern=".+@opshub\.com"
                title="Use your @opshub.com office email"
                required
              />
              <Input
                name="password"
                type="password"
                placeholder="Password (min 6 characters)"
                required
                minLength={6}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending code…" : "Continue"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-3">
              <Input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                className="text-center font-mono text-lg tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                required
              />
              {info && !error && <p className="text-sm text-muted-foreground">{info}</p>}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? "Verifying…" : "Verify & sign in"}
              </Button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-primary hover:underline"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("form"); setError(null); setInfo(null); }}
                  className="text-muted-foreground hover:underline"
                >
                  Change details
                </button>
              </div>
            </form>
          )}
          {step === "form" && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already registered?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
