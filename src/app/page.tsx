import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-3xl font-black text-accent-ink">
        B
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Bill Ready</h1>
      <p className="mt-3 max-w-sm text-muted">
        Invoice the job from your truck, get paid by card, and hand your bookkeeper a QuickBooks-ready file.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn-primary">
          Sign in
        </Link>
        <Link href="/login" className="btn-secondary">
          Create account
        </Link>
      </div>
    </main>
  );
}
