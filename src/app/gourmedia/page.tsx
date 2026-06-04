import type { Metadata } from "next";
import GourmediaClient from "./GourmediaClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Interno",
};

export default function GourmediaPage() {
  return <GourmediaClient />;
}
