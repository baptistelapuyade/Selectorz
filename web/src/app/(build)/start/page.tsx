import type { Metadata } from "next";
import { Builder } from "@/components/build/builder";

export const metadata: Metadata = {
  title: "Make your DJ page · Selectorz",
  description: "Paste one link and get the first version of your DJ page.",
};

export default function StartPage() {
  return <Builder />;
}
