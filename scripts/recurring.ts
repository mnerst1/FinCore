import { db } from "../src/lib/db";
import { settleRecurring, refreshReminders } from "../src/lib/recurring";
async function run() {
  for (const user of await db.user.findMany({ select: { id: true } })) {
    const count = await settleRecurring(user.id);
    await refreshReminders(user.id);
    console.log(user.id, count);
  }
}
run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
