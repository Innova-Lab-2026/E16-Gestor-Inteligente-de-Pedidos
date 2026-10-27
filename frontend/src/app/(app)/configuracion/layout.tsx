import { requireRole } from "@/features/auth/guards";

export default async function ConfigLayout({ children }: { children: React.ReactNode }) {
    await requireRole(["admin"]);
    return <div>{children}</div>
}
