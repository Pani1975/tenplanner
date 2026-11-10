import { ClubMonitorSpaceGuard } from "@/components/app/club-monitor-space-guard";

// Solo en el modo del club (o en el espacio de un monitor sin club).
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClubMonitorSpaceGuard>{children}</ClubMonitorSpaceGuard>;
}
