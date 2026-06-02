import { requirePermission } from "@/lib/bff/context";
import { withRoute } from "@/lib/bff/handler";
import { ok } from "@/lib/bff/response";
import { can } from "@/lib/rbac";

// GET /api/issues — list (filter status, phase)
export const GET = withRoute(async (req: Request) => {
  const ctx = await requirePermission("issues", "read");
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const phase = url.searchParams.get("phase");

  let query = ctx.supabase
    .from("issues")
    .select("*, job:job_id(job_code, customer_name)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (phase) query = query.eq("phase", phase);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ok(data ?? [], { can_write: can(ctx.role, "issues", "write") });
});
