import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="eyebrow mb-3">For contractors</p>
      <h1 className="text-5xl font-medium">
        Bill <em>Ready</em>
      </h1>
      <p className="mt-3 max-w-sm text-muted">
        Invoice the job from your truck. Get paid by card. Hand your bookkeeper a file that imports cleanly into QuickBooks.
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
