/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as certificates from "../certificates.js";
import type * as chapters from "../chapters.js";
import type * as chatSessions from "../chatSessions.js";
import type * as completions from "../completions.js";
import type * as contentItems from "../contentItems.js";
import type * as courses from "../courses.js";
import type * as debug from "../debug.js";
import type * as messages from "../messages.js";
import type * as migration from "../migration.js";
import type * as migrations from "../migrations.js";
import type * as progress from "../progress.js";
import type * as testQueries from "../testQueries.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_grading from "../utils/grading.js";
import type * as utils_progressUtils from "../utils/progressUtils.js";
import type * as videoProcessing from "../videoProcessing.js";
import type * as videos from "../videos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ai: typeof ai;
  auth: typeof auth;
  certificates: typeof certificates;
  chapters: typeof chapters;
  chatSessions: typeof chatSessions;
  completions: typeof completions;
  contentItems: typeof contentItems;
  courses: typeof courses;
  debug: typeof debug;
  messages: typeof messages;
  migration: typeof migration;
  migrations: typeof migrations;
  progress: typeof progress;
  testQueries: typeof testQueries;
  "utils/auth": typeof utils_auth;
  "utils/grading": typeof utils_grading;
  "utils/progressUtils": typeof utils_progressUtils;
  videoProcessing: typeof videoProcessing;
  videos: typeof videos;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
