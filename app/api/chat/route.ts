import { withDiagnostics } from "@/lib/tutor/diagnostics";
import { createChatHandler } from "@/lib/tutor/http";
export const runtime = "nodejs";
export const POST = withDiagnostics(createChatHandler());