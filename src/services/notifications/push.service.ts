import { prisma } from "@/lib/prisma";

/**
 * Sends an Expo push notification to a user's registered device.
 * Silent-fails — never throws so it cannot break the main flow.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    });
    if (!user?.expoPushToken) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: user.expoPushToken,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }),
    });
  } catch {
    // Silent-fail
  }
}
