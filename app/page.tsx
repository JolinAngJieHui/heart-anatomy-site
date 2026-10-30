import HeartExplorer from "@/components/HeartExplorer";
import { configuredTutorMode } from "@/lib/tutor/config";
import { readMinimalSelection } from "@/lib/knowledge-base/minimal";
import { connection } from "next/server";

export default async function Home() {
  // Hosting-time model permission must not be frozen into a static build.
  await connection();
  const selected = readMinimalSelection();
  return <HeartExplorer tutorMode={configuredTutorMode()} collectionId={selected?.id} collectionVersion={selected?.collectionVersion} />;
}
