import { runBirthdayPushes } from "../lib/loyalty/birthdayPush";

runBirthdayPushes()
  .then((result) => {
    console.log("Resultado:", JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
