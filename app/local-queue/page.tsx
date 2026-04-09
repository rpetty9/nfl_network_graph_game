import { notFound } from "next/navigation";
import LocalQueueClient from "./local-queue-client";

export default function LocalQueuePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <LocalQueueClient />;
}
