import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  const newPassword = "Quiero2026!";
  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.restaurantOwner.update({
    where: { email: "jaime@handroll.cl" },
    data: { passwordHash: hash, resetToken: null, resetTokenExpiry: null },
  });
  console.log(`✅ Contraseña actualizada: ${newPassword}`);
  await prisma.$disconnect();
}
main();
