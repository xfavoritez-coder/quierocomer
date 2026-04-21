export interface VisitorMetrics {
  totalVisitors: number;
  returningVisitors: number;
  returningPct: number;
  convertedCount: number;
  conversionPct: number;
  totalSessions: number;
  avgDurationMs: number;
  avgDishesViewed: number;
}

export interface FunnelData {
  totalGhosts: number;
  returnedGhosts: number;
  returnedPct: number;
  convertedUsers: number;
  convertedPct: number;
  activatedUsers: number;
  activatedPct: number;
}

export interface TicketTrend {
  weekStart: string;
  avgTicket: number;
  ticketCount: number;
  changePct: number | null;
}

export interface FailedSearch {
  query: string;
  timesSearched: number;
  uniqueVisitors: number;
  restaurants: string[];
  lastSearchedAt: string;
}

export interface GenioImpactComparison {
  withGenio: {
    avgDishesViewed: number;
    avgDurationMs: number;
    conversionRate: number;
    returnRate: number;
    sessionCount: number;
  };
  withoutGenio: {
    avgDishesViewed: number;
    avgDurationMs: number;
    conversionRate: number;
    returnRate: number;
    sessionCount: number;
  };
}

export interface TicketMatch {
  id: string;
  restaurantName: string;
  mesaId: string | null;
  ticketTotal: number;
  ticketCountItems: number | null;
  paidAt: string;
  matchConfidence: string | null;
  matchedSessionId: string | null;
  notes: string | null;
  createdAt: string;
}
