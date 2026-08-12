import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { reconcile } from "./activation.server";

export const reconcileActivations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ db: z.enum(["main", "lp"]) }).parse(input),
  )
  .handler(async ({ data }) => reconcile(data.db));