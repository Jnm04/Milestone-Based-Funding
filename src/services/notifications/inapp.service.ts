import { prisma } from "@/lib/prisma";

/**
 * Creates an in-app notification for a user.
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
}
