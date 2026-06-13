import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check email logs - search by email patterns with "ulises"
  const emailLogs = await prisma.emailLog.findMany({
    where: { to: { contains: 'ulises', mode: 'insensitive' } },
    select: { id: true, to: true, subject: true, purpose: true, createdAt: true },
    take: 10,
  });
  console.log('Email logs with ulises:', JSON.stringify(emailLogs, null, 2));

  // Check all recent email logs (today)
  const recentEmails = await prisma.emailLog.findMany({
    where: { createdAt: { gte: new Date('2026-05-24') } },
    select: { id: true, to: true, subject: true, purpose: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  console.log('Recent emails (last 2 days):', JSON.stringify(recentEmails, null, 2));

  // Check Resend/Postmark logs via lead events - search all leads from today
  const todayLeads = await prisma.lead.findMany({
    where: { createdAt: { gte: new Date('2026-05-25') } },
    select: { id: true, ownerName: true, email: true, whatsapp: true, localName: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Today leads:', JSON.stringify(todayLeads, null, 2));
}

main().finally(() => prisma.$disconnect());
