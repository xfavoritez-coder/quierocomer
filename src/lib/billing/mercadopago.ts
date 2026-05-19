/**
 * MercadoPago client para suscripciones y pagos de QuieroComer.
 *
 * Reemplaza al cliente Flow.cl. Usa el SDK v2 de MercadoPago con la API
 * class-based (MercadoPagoConfig, PreApprovalPlan, PreApproval, Preference, Customer).
 *
 * Moneda: CLP (enteros, sin decimales).
 * Env vars requeridas:
 *   - MERCADOPAGO_ACCESS_TOKEN   (server-side, privado)
 *   - NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY (client-side, publico)
 */

import {
  MercadoPagoConfig,
  Customer,
  PreApprovalPlan,
  PreApproval,
  Preference,
} from "mercadopago";

import {
  FLOW_PLANS,
  grossOf,
  TRIAL_DAYS,
  type PlanKey,
} from "./plans-config";

// ─── Configuracion ──────────────────────────────────────────────────────

let _config: MercadoPagoConfig | null = null;

/**
 * Inicializa (o retorna la instancia existente de) MercadoPagoConfig.
 * Se usa internamente en todas las funciones; tambien se puede llamar
 * para obtener el config si se necesita un cliente custom.
 */
export function initMercadoPago(): MercadoPagoConfig {
  if (_config) return _config;

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no esta definida");
  }

  _config = new MercadoPagoConfig({ accessToken });
  return _config;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
}

// ─── Customer ───────────────────────────────────────────────────────────

/**
 * Crea o encuentra un customer en MercadoPago por email.
 * Si ya existe uno con ese email, lo retorna. Si no, lo crea.
 */
export async function createMPCustomer(
  email: string,
  name: string,
): Promise<{ id: string; email: string }> {
  const config = initMercadoPago();
  const customerClient = new Customer(config);

  // Buscar si ya existe
  const search = await customerClient.search({ options: { email } });
  const existing = search.results?.find(
    (c) => c.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing?.id) {
    return { id: existing.id, email: existing.email ?? email };
  }

  // Crear nuevo
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(" ") || undefined;

  const created = await customerClient.create({
    body: {
      email,
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (!created.id) {
    throw new Error("MercadoPago no retorno un customer ID al crear");
  }

  return { id: created.id, email: created.email ?? email };
}

// ─── Plans (PreApprovalPlan) ────────────────────────────────────────────

export type MPPlanResult = {
  id: string;
  initPoint: string;
  reason: string;
  status: string;
};

/**
 * Crea un PreApprovalPlan en MercadoPago para el plan indicado.
 * Corresponde a la plantilla de suscripcion recurrente mensual.
 * El monto es BRUTO (neto + IVA).
 */
export async function createMPPlan(planKey: string): Promise<MPPlanResult> {
  const config = initMercadoPago();
  const planClient = new PreApprovalPlan(config);

  const key = planKey as Exclude<PlanKey, "FREE">;
  const planConfig = FLOW_PLANS[key];
  if (!planConfig) {
    throw new Error(`Plan "${planKey}" no existe en FLOW_PLANS`);
  }

  const amountGross = grossOf(planConfig.amountNet);
  const baseUrl = getBaseUrl();

  const result = await planClient.create({
    body: {
      reason: planConfig.name,
      back_url: `${baseUrl}/panel/suscripcion`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amountGross,
        currency_id: "CLP",
        free_trial: {
          frequency: TRIAL_DAYS,
          frequency_type: "days",
        },
      },
    },
  });

  if (!result.id) {
    throw new Error("MercadoPago no retorno un plan ID");
  }

  return {
    id: result.id,
    initPoint: result.init_point ?? "",
    reason: result.reason ?? planConfig.name,
    status: result.status ?? "active",
  };
}

// ─── Subscriptions (PreApproval) ────────────────────────────────────────

export type CreateMPSubscriptionParams = {
  /** Clave del plan: "GOLD" | "PREMIUM" */
  planKey: string;
  /** Email del pagador */
  payerEmail: string;
  /** Referencia externa (ej: restaurantId) */
  externalReference: string;
  /** Card token si se quiere asociar tarjeta de una vez */
  cardTokenId?: string;
  /** URL de retorno personalizada. Si no se provee, usa /panel/suscripcion */
  backUrl?: string;
  /** Fecha de inicio de la suscripcion (para diferir el primer cobro) */
  startDate?: Date;
  /** Monto bruto del primer mes (promo). Si no se provee, cobra regular desde el inicio */
  firstAmountGross?: number;
};

export type MPSubscriptionResult = {
  id: string;
  status: string;
  initPoint: string;
  payerEmail: string;
  externalReference: string;
  nextPaymentDate?: string;
};

/**
 * Crea una suscripcion (preapproval) SIN plan asociado.
 * Define la recurrencia inline para que MP genere el init_point
 * donde el usuario ingresa su tarjeta.
 */
export async function createMPSubscription(
  params: CreateMPSubscriptionParams,
): Promise<MPSubscriptionResult> {
  const config = initMercadoPago();
  const preApprovalClient = new PreApproval(config);
  const baseUrl = getBaseUrl();

  const key = params.planKey as Exclude<PlanKey, "FREE">;
  const planConfig = FLOW_PLANS[key];
  if (!planConfig) throw new Error(`Plan "${params.planKey}" no existe`);

  const amountGross = grossOf(planConfig.amountNet);

  const autoRecurring: Record<string, any> = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: amountGross,
    currency_id: "CLP",
  };

  // Primer mes con precio promo: free_trial simula el descuento
  // MP cobra transaction_amount del free_trial en el primer ciclo,
  // luego el transaction_amount regular en los siguientes.
  if (params.firstAmountGross && params.firstAmountGross < amountGross) {
    autoRecurring.free_trial = {
      frequency: 1,
      frequency_type: "months",
      first_invoice_amount: params.firstAmountGross,
    };
  }

  if (params.startDate) {
    autoRecurring.start_date = params.startDate.toISOString();
  }

  const body: Record<string, any> = {
    reason: planConfig.name,
    payer_email: params.payerEmail,
    external_reference: params.externalReference,
    back_url: params.backUrl ?? `${baseUrl}/panel/suscripcion`,
    auto_recurring: autoRecurring,
    status: "pending",
  };

  if (params.cardTokenId) {
    body.card_token_id = params.cardTokenId;
    body.status = "authorized";
  }

  const result = await preApprovalClient.create({ body });

  if (!result.id) {
    throw new Error("MercadoPago no retorno un subscription ID");
  }

  return {
    id: result.id,
    status: result.status ?? "pending",
    initPoint: result.init_point ?? "",
    payerEmail: result.payer_email ?? params.payerEmail,
    externalReference: result.external_reference ?? params.externalReference,
    nextPaymentDate: result.next_payment_date ?? undefined,
  };
}

/**
 * Cancela una suscripcion existente.
 */
export async function cancelMPSubscription(
  subscriptionId: string,
): Promise<{ id: string; status: string }> {
  const config = initMercadoPago();
  const preApprovalClient = new PreApproval(config);

  const result = await preApprovalClient.update({
    id: subscriptionId,
    body: { status: "cancelled" },
  });

  return {
    id: result.id ?? subscriptionId,
    status: result.status ?? "cancelled",
  };
}

/**
 * Obtiene el estado actual de una suscripcion.
 */
export async function getMPSubscription(
  subscriptionId: string,
): Promise<MPSubscriptionResult> {
  const config = initMercadoPago();
  const preApprovalClient = new PreApproval(config);

  const result = await preApprovalClient.get({ id: subscriptionId });

  return {
    id: result.id ?? subscriptionId,
    status: result.status ?? "unknown",
    initPoint: result.init_point ?? "",
    payerEmail: result.payer_email ?? "",
    externalReference: result.external_reference ?? "",
    nextPaymentDate: result.next_payment_date ?? undefined,
  };
}

// ─── One-time Preference (promo primer mes) ─────────────────────────────

export type CreateMPPreferenceParams = {
  /** Titulo del item (ej: "QuieroComer Premium - Primer mes") */
  title: string;
  /** Monto BRUTO en CLP (enteros) */
  amountGross: number;
  /** Referencia externa (ej: restaurantId o activationId) */
  externalReference: string;
  /** Email del pagador */
  payerEmail: string;
  /** URL de notificacion webhook (IPN) */
  notificationUrl?: string;
  /** URLs de retorno personalizadas. Si no se proveen, usa /panel/suscripcion */
  backUrls?: {
    success: string;
    failure: string;
    pending: string;
  };
};

export type MPPreferenceResult = {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
};

/**
 * Crea una preferencia de pago unico. Se usa para el cobro promocional
 * del primer mes (ej: PREMIUM a $4.900 + IVA).
 */
export async function createMPPreference(
  params: CreateMPPreferenceParams,
): Promise<MPPreferenceResult> {
  const config = initMercadoPago();
  const preferenceClient = new Preference(config);
  const baseUrl = getBaseUrl();

  const result = await preferenceClient.create({
    body: {
      items: [
        {
          id: params.externalReference,
          title: params.title,
          quantity: 1,
          unit_price: params.amountGross,
          currency_id: "CLP",
        },
      ],
      payer: {
        email: params.payerEmail,
      },
      external_reference: params.externalReference,
      back_urls: params.backUrls ?? {
        success: `${baseUrl}/panel/suscripcion?status=approved`,
        failure: `${baseUrl}/panel/suscripcion?status=failure`,
        pending: `${baseUrl}/panel/suscripcion?status=pending`,
      },
      auto_return: "approved",
      ...(params.notificationUrl
        ? { notification_url: params.notificationUrl }
        : {}),
    },
  });

  if (!result.id) {
    throw new Error("MercadoPago no retorno un preference ID");
  }

  return {
    id: result.id,
    initPoint: result.init_point ?? "",
    sandboxInitPoint: result.sandbox_init_point ?? "",
  };
}
