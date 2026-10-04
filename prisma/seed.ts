import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";
import { createDefaults } from "../src/lib/sample";
async function main() {
  const email = "demo@fincore.local";
  if (await db.user.findUnique({ where: { email } })) {
    console.log("Demo already exists. Seed leaves existing data unchanged.");
    return;
  }
  const password = process.env.DEMO_PASSWORD || "FinCore-Demo-2026!";
  if (password.length < 12)
    throw new Error("DEMO_PASSWORD must contain at least 12 characters");
  const passwordHash = await hashPassword(password);
  await db.$transaction(
    async (tx) => {
      const u = await tx.user.create({
        data: { email, name: "Alex Morgan", passwordHash },
      });
      await createDefaults(tx, u.id, true);
    },
    { timeout: 30000 },
  );
  console.log(
    "Demo ready: demo@fincore.local (password from DEMO_PASSWORD / documented default).",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
