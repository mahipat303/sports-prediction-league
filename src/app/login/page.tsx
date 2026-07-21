"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetWelcome } from "@/lib/welcome";
import { OpsHubLogo } from "@/components/opshub-logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasGoogle = params.get("google") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password — or your email isn't verified yet (register again to get a new code)");
    } else {
      resetWelcome(); // ensure the welcome popup shows again this login
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-sm">
      <div className="mb-5 flex justify-center">
        <OpsHubLogo width={160} />
      </div>
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-lg">
            <Trophy className="h-6 w-6" />
          </span>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in with your office email to start predicting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="you@opshub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {hasGoogle && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { resetWelcome(); signIn("google", { callbackUrl: "/" }); }}
            >
              Continue with Google
            </Button>
          )}

          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
