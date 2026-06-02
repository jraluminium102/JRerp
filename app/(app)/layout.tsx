import { redirect } from "next/navigation";
import { getContext } from "@/lib/bff/context";
import { menusFor } from "@/lib/rbac";
import { Shell } from "@/components/shell/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  if (!ctx) redirect("/login");

  const menus = menusFor(ctx.role);
  return (
    <Shell
      menus={menus}
      role={ctx.role}
      userName={ctx.profile.full_name ?? ctx.profile.email ?? "ผู้ใช้"}
      avatarUrl={ctx.profile.avatar_url}
    >
      {children}
    </Shell>
  );
}
