import type { api } from "@alloo/backend/api";
import type { FunctionReturnType } from "convex/server";

export type ConversationDetails = NonNullable<FunctionReturnType<typeof api.conversations.details>>;
