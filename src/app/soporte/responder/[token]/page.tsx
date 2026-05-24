import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ReplyClient from "./ReplyClient";

export default async function ReplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const msg = await prisma.supportMessage.findUnique({
    where: { replyToken: token },
    select: {
      id: true, name: true, email: true, message: true, createdAt: true,
      replies: { orderBy: { createdAt: "asc" }, select: { from: true, text: true, createdAt: true } },
    },
  });

  if (!msg) notFound();

  // Serialize dates for client component
  const thread = {
    ...msg,
    createdAt: msg.createdAt.toISOString(),
    replies: msg.replies.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };

  return <ReplyClient token={token} thread={thread} />;
}
