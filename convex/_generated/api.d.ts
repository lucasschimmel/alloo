/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as accounts from "../accounts.js";
import type * as attachmentHttp from "../attachmentHttp.js";
import type * as attachmentRecords from "../attachmentRecords.js";
import type * as auth from "../auth.js";
import type * as authIssuance from "../authIssuance.js";
import type * as authSettings from "../authSettings.js";
import type * as avatarRecords from "../avatarRecords.js";
import type * as avatars from "../avatars.js";
import type * as callLifecycle from "../callLifecycle.js";
import type * as calls from "../calls.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as deployment from "../deployment.js";
import type * as email from "../email.js";
import type * as groupLifecycle from "../groupLifecycle.js";
import type * as http from "../http.js";
import type * as maintenance from "../maintenance.js";
import type * as messages from "../messages.js";
import type * as moderation from "../moderation.js";
import type * as presence from "../presence.js";
import type * as profiles from "../profiles.js";
import type * as push from "../push.js";
import type * as pushDelivery from "../pushDelivery.js";
import type * as turn from "../turn.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  accounts: typeof accounts;
  attachmentHttp: typeof attachmentHttp;
  attachmentRecords: typeof attachmentRecords;
  auth: typeof auth;
  authIssuance: typeof authIssuance;
  authSettings: typeof authSettings;
  avatarRecords: typeof avatarRecords;
  avatars: typeof avatars;
  callLifecycle: typeof callLifecycle;
  calls: typeof calls;
  conversations: typeof conversations;
  crons: typeof crons;
  deployment: typeof deployment;
  email: typeof email;
  groupLifecycle: typeof groupLifecycle;
  http: typeof http;
  maintenance: typeof maintenance;
  messages: typeof messages;
  moderation: typeof moderation;
  presence: typeof presence;
  profiles: typeof profiles;
  push: typeof push;
  pushDelivery: typeof pushDelivery;
  turn: typeof turn;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
