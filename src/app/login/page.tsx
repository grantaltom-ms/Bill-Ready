import { loginErrorMessage } from "@/lib/auth-messages";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold">Sign in to Bill Ready</h1>
        <p className="mt-1 text-sm text-muted">
          No password. We&apos;ll email you a sign-in link. New here? Same button creates your account.
        </p>
        <LoginForm initialError={loginErrorMessage(error)} />
      </div>
    </main>
  );
}
