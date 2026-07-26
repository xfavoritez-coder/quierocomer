"use client";
import { createContext, useContext, useState, useEffect } from "react";

type Lang = "es" | "en";

const translations = {
  es: {
    // Nav
    nav_home: "Inicio",
    nav_live: "Venta en vivo",
    nav_menu: "Mi Carta",
    nav_analytics: "Analytics",
    nav_clients: "Clientes",
    nav_offers: "Ofertas",
    nav_announcements: "Anuncios",
    nav_control: "Control",
    nav_export: "Exportar carta",
    nav_waiter: "Llamar garzón",
    nav_users: "Usuarios",
    nav_restaurant: "Mi Restaurante",
    nav_settings: "Ajustes",
    nav_support: "Soporte",
    nav_more: "Más",
    // Account
    my_profile: "Mi perfil",
    logout: "Cerrar sesión",
    change_password: "Cambiar contraseña",
    current_password: "Contraseña actual",
    new_password: "Nueva contraseña (mín. 8 chars, 1 número)",
    confirm_password: "Confirmar nueva contraseña",
    saving: "Guardando...",
    save: "Guardar",
    password_updated: "¡Contraseña actualizada!",
    connection_error: "Error de conexión",
    password_min: "Mínimo 8 caracteres",
    password_number: "Debe contener al menos 1 número",
    passwords_mismatch: "Las contraseñas no coinciden",
    // Ajustes page
    settings_title: "Ajustes",
    settings_subtitle: "Configura las opciones de tu carta y local",
    your_menu: "Tu carta",
    copy: "Copiar",
    link_copied: "Link copiado",
    default_view: "Vista de la carta por defecto",
    default_view_desc: "La vista que verán tus clientes al abrir la carta",
    available_from_gold: "Disponible desde el plan Gold →",
    available_premium: "Disponible en el plan Premium →",
    view_gallery: "Galería",
    view_list: "Lista",
    view_impact: "Impact",
    category_index: "Índice de categorías",
    category_index_need: "Necesitas al menos 3 categorías para activar esta función (tienes {count})",
    category_index_active: "Tus clientes ven una pantalla de bienvenida con todas las secciones antes de la carta",
    category_index_inactive: "Ideal si tu carta tiene muchas secciones. Muestra una pantalla de inicio con todas las categorías para que el cliente navegue fácil",
    preview: "Ver cómo se ve",
    menu_mode: "Modo por defecto de la carta",
    panel_mode: "Modo del panel",
    light: "Claro",
    dark: "Oscuro",
    design: "Diseño",
    design_desc: "Color de tu carta: precios, botones y detalles",
    waiter_bell: "Campanita garzón",
    waiter_active: "Activada. Los clientes pueden llamar al garzón",
    waiter_inactive: "Desactivada. Los clientes no pueden llamar al garzón",
    saved: "Guardado",
    save_error: "Error al guardar",
    select_restaurant: "Selecciona un restaurante",
    apply_color: "Aplicar color",
    language: "Idioma",
    language_desc: "Elige el idioma del panel de administración",
    // Layout banners
    loading_panel: "Cargando tu panel...",
    demo_badge: "PANEL DEMO",
    demo_tooltip: "Este es un panel de ejemplo con datos ficticios. Al activar tu carta verás tus estadísticas reales.",
    view_menu: "Ver mi carta",
    activate: "Activar →",
    demo_title: "Así se verá tu panel",
    demo_subtitle: "(datos ficticios, al activar queda en cero)",
    upgrade_banner: "Gold desde $29.900/mes y desbloquea estadísticas, ofertas, vistas y más.",
    try_now: "Probar ahora",
    // Plan modal
    trial_days: "7 días gratis",
    monthly: "Mensualidad",
    vat: "IVA (19%)",
    total_monthly: "Total mensual",
    trial_info: "No se te cobra nada. Tu periodo de prueba de 7 días se activa de inmediato.",
    payment_redirect: "Serás redirigido a Webpay. Tu nuevo período comenzará el",
    no_days_lost: "No pierdes días del período actual.",
    payment_info: "Serás redirigido a Webpay para completar tu pago con tarjeta de débito o crédito.",
    secure_payment: "Pago seguro vía Webpay",
    activating: "Activando...",
    redirecting: "Redirigiendo...",
    start_trial: "Activar 7 días gratis",
    pay: "Pagar",
    cancel_plan: "Cancelar plan",
    cancelling: "Cancelando…",
    close: "Cerrar",
    includes_all: "Incluye todas las funciones del plan anterior",
    enjoying_plan: "Estás disfrutando de este plan",
    renew_month: "Renovar por otro mes",
    new_period_starts: "Tu nuevo período comenzará el",
    pay_today: "Pagas hoy y no pierdes días",
    // Expiry banners
    menu_inactive: "Tu carta QR no está activa",
    menu_inactive_sub: "Activa un plan para que tus clientes puedan ver tu carta digital.",
    see_plans: "Ver planes",
    menu_offline: "Tu carta QR está fuera de línea",
    menu_offline_sub: "Renueva tu plan para que tus clientes vuelvan a verla.",
    renew_now: "Renovar ahora",
    plan_expires_today: "Tu plan vence hoy",
    plan_expires_today_sub: "Tu carta QR dejará de mostrarse mañana si no renuevas.",
    plan_expires_tomorrow: "Tu plan vence mañana",
    plan_expires_tomorrow_sub: "Renueva para mantener tu carta QR activa sin interrupciones.",
    // Password required
    pw_required_title: "Cambio de contraseña requerido",
    pw_required_desc: "Por seguridad, debes cambiar tu contraseña temporal antes de continuar.",
    pw_temp_placeholder: "Tu contraseña temporal",
    pw_new_placeholder: "Mín. 8 caracteres, 1 número",
    pw_confirm_placeholder: "Repite la nueva contraseña",
    pw_all_required: "Todos los campos son requeridos",
    pw_min_length: "La nueva contraseña debe tener al menos 8 caracteres",
    pw_need_number: "La nueva contraseña debe contener al menos 1 número",
    pw_updated: "Contraseña actualizada",
    pw_change_error: "Error al cambiar contraseña",
    // Common
    subscription_activated: "Suscripción activada",
    subscription_error: "No se pudo completar la inscripción",
    try_again: "Intenta de nuevo.",
    upgrade_mejora: "Mejora tu carta con",
    // Mi Restaurante
    mr_title: "Mi Restaurante",
    mr_general: "Información general",
    mr_name: "Nombre del restaurante",
    mr_description: "Descripción",
    mr_address: "Dirección",
    mr_phone: "Teléfono",
    mr_whatsapp: "WhatsApp",
    mr_instagram: "Instagram",
    mr_website: "Sitio web",
    mr_logo: "Logo",
    mr_banner: "Banner",
    mr_save: "Guardar cambios",
    mr_saving: "Guardando...",
    mr_saved: "Guardado",
    mr_schedule: "Horarios",
    mr_billing: "Datos de facturación",
    mr_plan: "Plan activo",
    mr_autorenew: "Cobro automático mensual",
    mr_autorenew_active: "Tu plan se renueva automáticamente cada mes con la tarjeta registrada en Flow. No necesitas hacer nada.",
    mr_autorenew_inactive: "Activa el cobro automático para que tu plan se renueve cada mes sin que tengas que acordarte.",
    mr_activate_autorenew: "Activar cobro automático",
    mr_activating: "Iniciando…",
    mr_autorenew_ok: "✅ Cobro automático activado",
    mr_autorenew_ok_desc: "Tu plan se renovará automáticamente cuando venza el período actual.",
    mr_autorenew_pending: "✅ Tarjeta registrada",
    mr_autorenew_pending_desc: "Tu suscripción quedó creada. Flow procesará el primer cobro en los próximos minutos.",
    mr_autorenew_error: "❌ Error al activar cobro automático",
    mr_autorenew_error_desc: "Intenta nuevamente o contacta soporte@quierocomer.com",
    // Analytics
    analytics_title: "Analytics",
    analytics_views: "Vistas",
    analytics_scans: "Escaneos",
    analytics_dishes: "Platos más vistos",
    // Menus / Mi Carta
    menu_title: "Mi Carta",
    menu_add_category: "Añadir categoría",
    menu_add_dish: "Añadir plato",
    menu_import: "Importar carta",
    menu_no_dishes: "No hay platos aún",
    // Clients
    clients_title: "Clientes",
    // Offers
    offers_title: "Ofertas",
    // Users
    users_title: "Usuarios",
    users_invite: "Invitar usuario",
    // Support
    support_title: "Soporte",
    // Anuncios
    announcements_title: "Anuncios",
  },
  en: {
    // Nav
    nav_home: "Home",
    nav_live: "Live Sales",
    nav_menu: "My Menu",
    nav_analytics: "Analytics",
    nav_clients: "Customers",
    nav_offers: "Offers",
    nav_announcements: "Announcements",
    nav_control: "Control",
    nav_export: "Export Menu",
    nav_waiter: "Call Waiter",
    nav_users: "Users",
    nav_restaurant: "My Restaurant",
    nav_settings: "Settings",
    nav_support: "Support",
    nav_more: "More",
    // Account
    my_profile: "My profile",
    logout: "Log out",
    change_password: "Change password",
    current_password: "Current password",
    new_password: "New password (min. 8 chars, 1 number)",
    confirm_password: "Confirm new password",
    saving: "Saving...",
    save: "Save",
    password_updated: "Password updated!",
    connection_error: "Connection error",
    password_min: "At least 8 characters required",
    password_number: "Must contain at least 1 number",
    passwords_mismatch: "Passwords do not match",
    // Ajustes page
    settings_title: "Settings",
    settings_subtitle: "Configure your menu and restaurant options",
    your_menu: "Your menu",
    copy: "Copy",
    link_copied: "Link copied",
    default_view: "Default menu view",
    default_view_desc: "The view your customers will see when opening the menu",
    available_from_gold: "Available from the Gold plan →",
    available_premium: "Available on the Premium plan →",
    view_gallery: "Gallery",
    view_list: "List",
    view_impact: "Impact",
    category_index: "Category index",
    category_index_need: "You need at least 3 categories to enable this feature (you have {count})",
    category_index_active: "Your customers see a welcome screen with all sections before the menu",
    category_index_inactive: "Ideal if your menu has many sections. Shows a home screen with all categories for easy navigation",
    preview: "See preview",
    menu_mode: "Default menu mode",
    panel_mode: "Panel mode",
    light: "Light",
    dark: "Dark",
    design: "Design",
    design_desc: "Menu color: prices, buttons and details",
    waiter_bell: "Waiter bell",
    waiter_active: "Enabled. Customers can call the waiter",
    waiter_inactive: "Disabled. Customers cannot call the waiter",
    saved: "Saved",
    save_error: "Error saving",
    select_restaurant: "Select a restaurant",
    apply_color: "Apply color",
    language: "Language",
    language_desc: "Choose the language for the admin panel",
    // Layout banners
    loading_panel: "Loading your panel...",
    demo_badge: "DEMO PANEL",
    demo_tooltip: "This is a sample panel with fictional data. Once you activate your menu you'll see your real stats.",
    view_menu: "View my menu",
    activate: "Activate →",
    demo_title: "This is what your panel will look like",
    demo_subtitle: "(fictional data, resets to zero on activation)",
    upgrade_banner: "Gold from $29,900/mo and unlock analytics, offers, views and more.",
    try_now: "Try now",
    // Plan modal
    trial_days: "7 days free",
    monthly: "Monthly",
    vat: "Tax (19%)",
    total_monthly: "Monthly total",
    trial_info: "You won't be charged. Your 7-day free trial starts immediately.",
    payment_redirect: "You'll be redirected to Webpay. Your new period starts on",
    no_days_lost: "You won't lose days from the current period.",
    payment_info: "You'll be redirected to Webpay to complete your payment with debit or credit card.",
    secure_payment: "Secure payment via Webpay",
    activating: "Activating...",
    redirecting: "Redirecting...",
    start_trial: "Start 7-day free trial",
    pay: "Pay",
    cancel_plan: "Cancel plan",
    cancelling: "Cancelling…",
    close: "Close",
    includes_all: "Includes all features from the previous plan",
    enjoying_plan: "You're enjoying this plan",
    renew_month: "Renew for another month",
    new_period_starts: "Your new period starts on",
    pay_today: "Pay today and keep your remaining days",
    // Expiry banners
    menu_inactive: "Your QR menu is not active",
    menu_inactive_sub: "Activate a plan so your customers can see your digital menu.",
    see_plans: "See plans",
    menu_offline: "Your QR menu is offline",
    menu_offline_sub: "Renew your plan so your customers can see it again.",
    renew_now: "Renew now",
    plan_expires_today: "Your plan expires today",
    plan_expires_today_sub: "Your QR menu will stop showing tomorrow if you don't renew.",
    plan_expires_tomorrow: "Your plan expires tomorrow",
    plan_expires_tomorrow_sub: "Renew to keep your QR menu active without interruptions.",
    // Password required
    pw_required_title: "Password change required",
    pw_required_desc: "For security, you must change your temporary password before continuing.",
    pw_temp_placeholder: "Your temporary password",
    pw_new_placeholder: "Min. 8 characters, 1 number",
    pw_confirm_placeholder: "Repeat new password",
    pw_all_required: "All fields are required",
    pw_min_length: "New password must be at least 8 characters",
    pw_need_number: "New password must contain at least 1 number",
    pw_updated: "Password updated",
    pw_change_error: "Error changing password",
    // Common
    subscription_activated: "Subscription activated",
    subscription_error: "Could not complete subscription",
    try_again: "Please try again.",
    upgrade_mejora: "Upgrade your menu with",
    // Mi Restaurante
    mr_title: "My Restaurant",
    mr_general: "General information",
    mr_name: "Restaurant name",
    mr_description: "Description",
    mr_address: "Address",
    mr_phone: "Phone",
    mr_whatsapp: "WhatsApp",
    mr_instagram: "Instagram",
    mr_website: "Website",
    mr_logo: "Logo",
    mr_banner: "Banner",
    mr_save: "Save changes",
    mr_saving: "Saving...",
    mr_saved: "Saved",
    mr_schedule: "Schedule",
    mr_billing: "Billing information",
    mr_plan: "Active plan",
    mr_autorenew: "Monthly auto-renewal",
    mr_autorenew_active: "Your plan renews automatically every month with your card saved in Flow. No action needed.",
    mr_autorenew_inactive: "Enable auto-renewal so your plan renews each month without having to remember.",
    mr_activate_autorenew: "Enable auto-renewal",
    mr_activating: "Starting…",
    mr_autorenew_ok: "✅ Auto-renewal activated",
    mr_autorenew_ok_desc: "Your plan will renew automatically when the current period ends.",
    mr_autorenew_pending: "✅ Card registered",
    mr_autorenew_pending_desc: "Your subscription has been created. Flow will process the first charge in the next few minutes.",
    mr_autorenew_error: "❌ Error activating auto-renewal",
    mr_autorenew_error_desc: "Try again or contact support@quierocomer.com",
    // Analytics
    analytics_title: "Analytics",
    analytics_views: "Views",
    analytics_scans: "Scans",
    analytics_dishes: "Most viewed dishes",
    // Menus / Mi Carta
    menu_title: "My Menu",
    menu_add_category: "Add category",
    menu_add_dish: "Add dish",
    menu_import: "Import menu",
    menu_no_dishes: "No dishes yet",
    // Clients
    clients_title: "Customers",
    // Offers
    offers_title: "Offers",
    // Users
    users_title: "Users",
    users_invite: "Invite user",
    // Support
    support_title: "Support",
    // Anuncios
    announcements_title: "Announcements",
  },
} as const;

type TranslationKey = keyof typeof translations.es;

interface PanelLangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const PanelLangContext = createContext<PanelLangContextValue>({
  lang: "es",
  setLang: () => {},
  t: (key: string) => key,
});

export function PanelLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("qc_panel_lang") as Lang | null;
    if (stored === "es" || stored === "en") {
      setLangState(stored);
    } else {
      const nav = typeof navigator !== "undefined" ? navigator.language : "";
      setLangState(nav.startsWith("en") ? "en" : "es");
    }
    setReady(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("qc_panel_lang", l);
  };

  const t = (key: string): string => {
    const dict = translations[lang] as Record<string, string>;
    if (key in dict) return dict[key];
    // fallback to es
    const fallback = translations.es as Record<string, string>;
    return fallback[key] ?? key;
  };

  // Avoid hydration mismatch: render with default 'es' on server, then update on client
  const value: PanelLangContextValue = { lang: ready ? lang : "es", setLang, t };

  return (
    <PanelLangContext.Provider value={value}>
      {children}
    </PanelLangContext.Provider>
  );
}

export function usePanelLang(): PanelLangContextValue {
  return useContext(PanelLangContext);
}
