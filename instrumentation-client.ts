import { initBotId } from "botid/client/core";

if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  initBotId({
    protect: [{
      path: "/api/auth/sign-up/email",
      method: "POST",
      advancedOptions: { checkLevel: "basic" },
    }],
  });
}
