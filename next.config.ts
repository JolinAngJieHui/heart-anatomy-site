import type { NextConfig } from "next";
import activeCollection from "./knowledge-base/active-collection.json";

const nextConfig: NextConfig = {
  // Include the exact active reference files read dynamically by server routes.
  outputFileTracingIncludes: {
    "/*": [
      "./knowledge-base/active-collection.json",
      "./knowledge-base/registry.json",
      `./knowledge-base/collections/${activeCollection.id}/registry.json`,
      `./knowledge-base/collections/${activeCollection.id}/register.json`,
      `./knowledge-base/approved/${activeCollection.id}/*.md`,
    ],
  },
};

export default nextConfig;
