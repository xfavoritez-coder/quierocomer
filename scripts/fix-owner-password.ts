import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();

async function main() {
  const newPassword = "fogon-del-puerto2026";
  const hash = await bcrypt.hash(newPassword, 10);
  
  await db.restaurantOwner.update({
    where: { email: "favoritez@gmail.com" },
    data: { passwordHash: hash },
  });
  
  // Verify
  const owner = await db.restaurantOwner.findUnique({ where: { email: "favoritez@gmail.com" } });
  const matches = await bcrypt.compare(newPassword, owner!.passwordHash);
  console.log("✓ Contraseña actualizada. Verificación:", matches ? "OK" : "FALLO");
}

main().catch(console.error).finally(() => db.$disconnect());
