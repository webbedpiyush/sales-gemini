import { ParticipantCard } from "@/components/live/ParticipantCard";

interface LiveStageProps {
  buyerName: string;
  buyerSubtitle: string;
  buyerBadge: string;
  repName: string;
}

function toInitials(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function LiveStage({
  buyerName,
  buyerSubtitle,
  buyerBadge,
  repName,
}: LiveStageProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#101b49] via-[#1c3d8d] to-[#2563eb] p-8 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.14),transparent_40%)]" />
      <div className="relative grid gap-8 lg:grid-cols-2">
        <ParticipantCard
          name={buyerName}
          subtitle={buyerSubtitle}
          badgeLabel={buyerBadge}
          initials={toInitials(buyerName)}
          isActive
        />
        <ParticipantCard
          name={repName}
          subtitle="Sales Rep"
          badgeLabel="You"
          initials={toInitials(repName)}
        />
      </div>
    </section>
  );
}
