import { notFound } from "next/navigation";
import BackendTester from "./tester";

export const metadata = { title: "Backend test", robots: { index: false, follow: false } };

export default function BackendTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BackendTester />;
}
