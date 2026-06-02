/**
 * Email de reactivación para leads que no activaron.
 * Preview visual con platos reales y fotos.
 */
export function reactivationEmailHtml({
  ownerName,
  restaurantName,
  logoUrl,
  slug,
  dishCount,
  categories,
  cartaUrl,
  panelUrl,
  activarUrl,
  openPixel,
}: {
  ownerName: string;
  restaurantName: string;
  logoUrl?: string | null;
  slug: string;
  dishCount: number;
  categories: { name: string; dishCount: number; topDish?: string; topDishPhoto?: string | null; topDishPrice?: number | null }[];
  cartaUrl: string;
  panelUrl: string;
  activarUrl: string;
  openPixel: string;
}): string {
  const initials = restaurantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  // Food emoji fallbacks per category keyword
  const emojiFor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("sushi") || n.includes("roll") || n.includes("niguiri") || n.includes("maki")) return "🍣";
    if (n.includes("ceviche") || n.includes("tiradito") || n.includes("mar") || n.includes("pescad")) return "🐟";
    if (n.includes("pizza")) return "🍕";
    if (n.includes("hamburgues") || n.includes("burger")) return "🍔";
    if (n.includes("ensalad") || n.includes("verde")) return "🥗";
    if (n.includes("postre") || n.includes("dulce") || n.includes("helad")) return "🍰";
    if (n.includes("bebid") || n.includes("drink") || n.includes("jugo") || n.includes("refres")) return "🥤";
    if (n.includes("cervez") || n.includes("beer") || n.includes("chop")) return "🍺";
    if (n.includes("vino") || n.includes("wine") || n.includes("copa")) return "🍷";
    if (n.includes("cocktail") || n.includes("trago") || n.includes("pisco")) return "🍸";
    if (n.includes("café") || n.includes("cafe") || n.includes("coffee") || n.includes("cappu")) return "☕";
    if (n.includes("pollo") || n.includes("chicken") || n.includes("ave")) return "🍗";
    if (n.includes("carne") || n.includes("asado") || n.includes("parrill") || n.includes("steak") || n.includes("lomo")) return "🥩";
    if (n.includes("pasta") || n.includes("tallarin") || n.includes("spaghe") || n.includes("ñoqui")) return "🍝";
    if (n.includes("entrada") || n.includes("picoteo") || n.includes("aperitiv") || n.includes("empanada")) return "🥟";
    if (n.includes("taco") || n.includes("burrit") || n.includes("mexic") || n.includes("nachos")) return "🌮";
    if (n.includes("desayun") || n.includes("brunch") || n.includes("tostada")) return "🍳";
    if (n.includes("sandwich") || n.includes("sándwich") || n.includes("completo")) return "🥪";
    if (n.includes("wok") || n.includes("chino") || n.includes("asian") || n.includes("thai") || n.includes("chaufa")) return "🥡";
    if (n.includes("sopas") || n.includes("caldo") || n.includes("crema")) return "🍜";
    return "🍽";
  };

  const topCats = categories.slice(0, 4);

  const dishRows = topCats.map(c => {
    const emoji = emojiFor(c.name);
    const price = c.topDishPrice ? `$${c.topDishPrice.toLocaleString("es-CL")}` : "";
    const dishName = c.topDish || c.name;

    const photoCell = c.topDishPhoto
      ? `<td width="44" style="vertical-align:middle; padding-right:12px;">
          <img src="${c.topDishPhoto}" alt="" width="44" height="44" style="width:44px; height:44px; border-radius:10px; object-fit:cover; display:block;" />
        </td>`
      : `<td width="44" style="vertical-align:middle; padding-right:12px;">
          <div style="width:44px; height:44px; border-radius:10px; background:#f0e8d4; text-align:center; line-height:44px; font-size:20px;">
            ${emoji}
          </div>
        </td>`;

    return `<tr>
      <td style="padding:8px 0; border-bottom:1px solid #ece3d2;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${photoCell}
            <td style="vertical-align:middle;">
              <div style="font-size:10px; color:#b18432; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${c.name}</div>
              <div style="font-size:13px; font-weight:700; color:#8a7550; margin-top:1px;">${dishName}</div>
              <div style="font-size:11px; color:#6d6254; margin-top:1px;">${c.dishCount} platos${price ? ` · desde ${price}` : ""}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join("");

  const moreCount = categories.length - 4;
  const moreRow = moreCount > 0
    ? `<tr><td style="padding:8px 0 0; text-align:center;">
        <div style="font-size:13px; color:#b18432; font-weight:600;">+ ${moreCount} categorías más</div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f3efe7; font-family:Arial, Helvetica, sans-serif; color:#8a7550;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3efe7; padding:28px 12px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#fffaf1; border-radius:22px; overflow:hidden; border:1px solid #eadfca;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:34px 28px 18px;">
              <div style="font-size:11px; letter-spacing:1.6px; color:#b18432; font-weight:700; text-transform:uppercase;">
                QuieroComer
              </div>

              <div style="margin-top:16px; display:inline-block; background:#e8930a; color:#ffffff; font-size:12px; font-weight:800; padding:7px 12px; border-radius:999px; letter-spacing:0.3px;">
                Tu carta QR inteligente ya está lista
              </div>

              <h1 style="margin:22px 0 10px; font-size:30px; line-height:1.12; color:#8a7550;">
                Tus clientes podrían verla hoy.
              </h1>

              <p style="margin:0; font-size:16px; line-height:1.55; color:#8a7550;">
                Es gratis para siempre, solo falta que la compartas.
              </p>
            </td>
          </tr>

          <!-- Preview card (phone mockup) -->
          <tr>
            <td style="padding:12px 26px 4px;">
              <a href="${cartaUrl}" style="text-decoration:none; display:block;">
              <table width="260" align="center" cellpadding="0" cellspacing="0" style="background:#16120d; border-radius:32px; overflow:hidden; max-width:260px;">
                <tr>
                  <td style="padding:14px 10px;">
                    <!-- Phone notch -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td align="center" style="padding-bottom:10px;">
                        <div style="width:60px; height:5px; border-radius:3px; background:#2a2520;"></div>
                      </td></tr>
                    </table>

                    <div style="background:#fffaf1; border-radius:22px; padding:14px 14px 20px;">
                      <!-- Restaurant logo + name -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="28" style="vertical-align:middle; padding-right:8px;">
                            ${logoUrl
                              ? `<img src="${logoUrl}" alt="" width="28" height="28" style="width:28px; height:28px; border-radius:50%; object-fit:cover; display:block;" />`
                              : `<div style="width:28px; height:28px; border-radius:50%; background:#f0e8d4; text-align:center; line-height:28px; font-size:13px; font-weight:800; color:#b18432;">${initials}</div>`
                            }
                          </td>
                          <td style="vertical-align:middle;">
                            <div style="font-size:12px; color:#b18432; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;">
                              ${restaurantName}
                            </div>
                          </td>
                        </tr>
                      </table>

                      <!-- Dish list -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                        ${dishRows}
                        ${moreRow}
                      </table>
                    </div>

                  </td>
                </tr>
              </table>
              </a>
            </td>
          </tr>

          <!-- What you can do -->
          <tr>
            <td style="padding:22px 26px 4px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8eedc; border-radius:18px;">
                <tr>
                  <td style="padding:18px;">
                    <h3 style="margin:0 0 14px; font-size:17px; color:#8a7550;">
                      ¿Qué puedes hacer ahora?
                    </h3>

                    <p style="margin:0 0 10px; font-size:15px; color:#8a7550; line-height:1.45;">
                      ✅ Usarla gratis, de inmediato.
                    </p>

                    <p style="margin:0 0 10px; font-size:15px; color:#8a7550; line-height:1.45;">
                      ✅ Compartirla por WhatsApp, Instagram o código QR.
                    </p>

                    <p style="margin:0; font-size:15px; color:#8a7550; line-height:1.45;">
                      ✅ Editar platos y precios desde tu celular.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:26px 28px 10px;">
              <a href="${cartaUrl}" style="display:block; background:#e8930a; color:#ffffff; text-decoration:none; font-size:17px; font-weight:800; padding:16px 22px; border-radius:12px; text-align:center;">
                Ver mi carta →
              </a>

            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height:20px;"></td></tr>

        </table>

        <!-- Branding -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding:22px 0;">
              <p style="margin:0; font-size:12px; color:#a89b88;">QuieroComer.cl · 2026 · Hecho en Chile</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
  <img src="${openPixel}" alt="" width="1" height="1" style="display:none" />
</body>
</html>`;
}
