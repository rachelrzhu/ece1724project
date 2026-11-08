export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl">Hello world</h1>
      {process.env.NODE_ENV === "development" && <a className="underline" href="/backend-test">Backend test page</a>}
    </main>
  );
}
