/**
 * Segment rule evaluator — counts how many guests/users match a set of rules.
 *
 * Rule structure: { field, operator, value }
 * Fields: dietType, restriction, visitCount, lastVisitDaysAgo, registered, sessionDuration, viewPreference
 */
import { prisma } from "@/lib/prisma";

interface Rule {
  field: string;
  operator: string; // eq, neq, gte, lte, contains, exists
  value: any;
}

export async function evaluateSegment(restaurantId: string, rules: Rule[]): Promise<{
  count: number;
  registeredCount: number;
  ghostCount: number;
  userIds: string[];
}> {
  // Get all guests who visited this restaurant
  const guests = await prisma.guestProfile.findMany({
    where: {
      sessions: { some: { restaurantId } },
    },
    select: {
      id: true,
      visitCount: true,
      lastSeenAt: true,
      linkedQrUserId: true,
      linkedQrUser: {
        select: {
          id: true,
          dietType: true,
          restrictions: true,
          birthDate: true,
          email: true,
          unsubscribedAt: true,
          lastEmailAt: true,
        },
      },
      sessions: {
        where: { restaurantId },
        select: { durationMs: true, viewUsed: true, startedAt: true },
        orderBy: { startedAt: "desc" },
        take: 10,
      },
    },
  });

  const now = Date.now();
  const matchedGuests: string[] = [];
  const matchedUserIds: string[] = [];

  for (const guest of guests) {
    const user = guest.linkedQrUser;
    const lastSession = guest.sessions[0];
    const avgDuration = guest.sessions.length > 0
      ? guest.sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0) / guest.sessions.length
      : 0;
    const daysSinceLastVisit = lastSession
      ? Math.floor((now - new Date(lastSession.startedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    const mostUsedView = getMostUsedView(guest.sessions);

    let matches = true;
    for (const rule of rules) {
      if (!evaluateRule(rule, { guest, user, avgDuration, daysSinceLastVisit, mostUsedView })) {
        matches = false;
        break;
      }
    }

    if (matches) {
      matchedGuests.push(guest.id);
      if (user) matchedUserIds.push(user.id);
    }
  }

  return {
    count: matchedGuests.length,
    registeredCount: matchedUserIds.length,
    ghostCount: matchedGuests.length - matchedUserIds.length,
    userIds: matchedUserIds,
  };
}

function evaluateRule(rule: Rule, ctx: any): boolean {
  const { guest, user, avgDuration, daysSinceLastVisit, mostUsedView } = ctx;

  switch (rule.field) {
    case "registered":
      return rule.value === "true" ? !!user : !user;

    case "dietType":
      if (!user) return false;
      return rule.operator === "eq" ? user.dietType === rule.value : user.dietType !== rule.value;

    case "restriction":
      if (!user) return false;
      return rule.operator === "contains"
        ? user.restrictions.includes(rule.value)
        : !user.restrictions.includes(rule.value);

    case "visitCount":
      return compare(guest.visitCount, rule.operator, Number(rule.value));

    case "lastVisitDaysAgo":
      return compare(daysSinceLastVisit, rule.operator, Number(rule.value));

    case "sessionDuration":
      // avgDuration in ms, value in seconds
      return compare(avgDuration / 1000, rule.operator, Number(rule.value));

    case "viewPreference":
      return mostUsedView === rule.value;

    case "hasBirthday":
      return rule.value === "true" ? !!user?.birthDate : !user?.birthDate;

    case "unsubscribed":
      return rule.value === "true" ? !!user?.unsubscribedAt : !user?.unsubscribedAt;

    default:
      return true;
  }
}

function compare(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case "gte": return actual >= expected;
    case "lte": return actual <= expected;
    case "eq": return actual === expected;
    case "gt": return actual > expected;
    case "lt": return actual < expected;
    default: return true;
  }
}

function getMostUsedView(sessions: { viewUsed: string | null }[]): string | null {
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.viewUsed) counts[s.viewUsed] = (counts[s.viewUsed] || 0) + 1;
  }
  let max = 0;
  let top: string | null = null;
  for (const [view, count] of Object.entries(counts)) {
    if (count > max) { max = count; top = view; }
  }
  return top;
}

/** Generate auto-segments based on detected patterns */
export async function generateAutoSegments(restaurantId: string): Promise<Rule[][]> {
  const suggestions: { name: string; description: string; rules: Rule[] }[] = [];

  // Count diets
  const dietCounts = await prisma.qRUser.groupBy({
    by: ["dietType"],
    where: {
      dietType: { not: null },
      guestProfiles: { some: { sessions: { some: { restaurantId } } } },
    },
    _count: { id: true },
  });

  for (const d of dietCounts) {
    if (d._count.id >= 3 && d.dietType) {
      suggestions.push({
        name: `${d.dietType === "vegetarian" ? "Vegetarianos" : d.dietType === "vegan" ? "Veganos" : d.dietType === "pescetarian" ? "Pescetarianos" : "Omnivoros"}`,
        description: `${d._count.id} clientes con dieta ${d.dietType}`,
        rules: [{ field: "dietType", operator: "eq", value: d.dietType }],
      });
    }
  }

  // Inactive (>14 days)
  suggestions.push({
    name: "Inactivos",
    description: "Clientes que no visitan hace más de 14 días",
    rules: [{ field: "lastVisitDaysAgo", operator: "gte", value: "14" }, { field: "registered", operator: "eq", value: "true" }],
  });

  // Engaged (avg session > 60s)
  suggestions.push({
    name: "Engaged",
    description: "Clientes con sesiones promedio mayor a 60 segundos",
    rules: [{ field: "sessionDuration", operator: "gte", value: "60" }],
  });

  // Recurrentes (5+ visitas)
  suggestions.push({
    name: "Recurrentes",
    description: "Clientes con 5 o más visitas",
    rules: [{ field: "visitCount", operator: "gte", value: "5" }],
  });

  return suggestions.map(s => s.rules);
}
