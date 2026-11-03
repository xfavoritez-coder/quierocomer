import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
const prisma = new PrismaClient();
async function main() {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas
  await prisma.restaurantOwner.update({
    where: { email: "jaime@handroll.cl" },
    data: { resetToken: token, resetTokenExpiry: expires },
  });
  const url = `https://quierocomer.com/recuperar-password?token=${token}`;
  console.log(`\n✅ Link de recuperación (válido 2h):\n${url}\n`);
  await prisma.$disconnect();
}
main();
