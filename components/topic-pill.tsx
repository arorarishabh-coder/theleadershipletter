import Link from "next/link";
import { cn } from "@/lib/utils";
import { getTopicBySlug } from "@/lib/queries";
import type { PostTopic } from "@/lib/types";

interface TopicPillProps {
  topic: PostTopic;
  size?: "sm" | "md";
}

export function TopicPill({ topic, size = "sm" }: TopicPillProps) {
  const t = getTopicBySlug(topic);
  if (!t) return null;
  return (
    <Link
      href={`/topic/${t.slug}`}
      className={cn(
        "inline-flex items-center border border-ink/30 font-mono uppercase tracking-dateline text-ink transition-colors hover:bg-ink hover:text-parchment",
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
      )}
    >
      {t.label}
    </Link>
  );
}
