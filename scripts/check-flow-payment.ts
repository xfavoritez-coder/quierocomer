import { flowPost } from "../src/lib/billing/flow";
flowPost("/payment/getStatus", { token: "A5861EA9CF085122B2A28FBAD383A1F16C9DEF3I" })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch((e: any) => console.error("Error:", e.message, e.code, e.status));
