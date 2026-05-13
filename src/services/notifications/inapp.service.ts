import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "./push.service";

/**
 * Creates an in-app notification for a user and sends a push notification
 * if the user has a registered Expo push token.
 * Silent-fails — never throws so it cannot break the main flow.
 */
export async function createNotification(
  userId: string,
  title: string,
  body: string,
  href?: string
): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, title, body, href: href ?? null } });
    // Prune old read notifications to keep the table lean (keep last 100 per user)
    const old = await prisma.notification.findMany({
      where: { userId, read: true },
      orderBy: { createdAt: "desc" },
      skip: 100,
      select: { id: true },
    });
    if (old.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: old.map(n => n.id) } } });
    }
  } catch {
    // Silent-fail
  }

  // Fire-and-forget push notification — independent of in-app write success
  const pushData: Record<string, unknown> = {};
  if (href) {
    pushData.href = href;
    // Extract contractId from paths like /contract/abc123
    const match = href.match(/^\/contract\/([^/]+)$/);
    if (match) pushData.contractId = match[1];
  }
  sendPushNotification(userId, title, body, pushData).catch(() => {});
}
