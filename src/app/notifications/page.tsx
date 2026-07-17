import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, Trophy, Clock, Award, TrendingUp, Gift } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markNotificationsRead } from "@/app/actions";
import { cn, formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const typeIcons: Record<string, typeof Bell> = {
  UPCOMING_MATCH: Clock,
  PREDICTION_CLOSING: Clock,
  RESULT_DECLARED: Trophy,
  LEADERBOARD_CHANGE: TrendingUp,
  ACHIEVEMENT: Award,
  BONUS_AWARDED: Gift,
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="h-6 w-6" /> Notifications
          </h1>
          {unread > 0 && (
            <p className="text-sm text-muted-foreground">{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <form action={markNotificationsRead}>
            <Button variant="outline" size="sm" type="submit">
              Mark all read
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nothing yet. You&apos;ll be notified about results, closing predictions, and bonuses. 🔔
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = typeIcons[n.type] ?? Bell;
            const body = (
              <Card
                className={cn(
                  "transition-colors",
                  !n.read && "border-primary/40 bg-primary/5"
                )}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </CardContent>
              </Card>
            );
            return n.link ? (
              <Link key={n.id} href={n.link}>{body}</Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
