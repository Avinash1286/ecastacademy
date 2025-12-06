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
import type * as aiConfig from "../aiConfig.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as capsuleGeneration from "../capsuleGeneration.js";
import type * as capsules from "../capsules.js";
import type * as certificates from "../certificates.js";
import type * as chapters from "../chapters.js";
import type * as chatSessions from "../chatSessions.js";
import type * as completions from "../completions.js";
import type * as contentItems from "../contentItems.js";
import type * as courses from "../courses.js";
import type * as crons from "../crons.js";
import type * as generationJobs from "../generationJobs.js";
import type * as messages from "../messages.js";
import type * as progress from "../progress.js";
import type * as rateLimit from "../rateLimit.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_cache from "../utils/cache.js";
import type * as utils_certificateSignature from "../utils/certificateSignature.js";
import type * as utils_grading from "../utils/grading.js";
import type * as utils_optimisticLocking from "../utils/optimisticLocking.js";
import type * as utils_progressUtils from "../utils/progressUtils.js";
import type * as utils_transactions from "../utils/transactions.js";
import type * as utils_types from "../utils/types.js";
import type * as utils_validation from "../utils/validation.js";
import type * as videoProcessing from "../videoProcessing.js";
import type * as videos from "../videos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ai: typeof ai;
  aiConfig: typeof aiConfig;
  audit: typeof audit;
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  capsuleGeneration: typeof capsuleGeneration;
  capsules: typeof capsules;
  certificates: typeof certificates;
  chapters: typeof chapters;
  chatSessions: typeof chatSessions;
  completions: typeof completions;
  contentItems: typeof contentItems;
  courses: typeof courses;
  crons: typeof crons;
  generationJobs: typeof generationJobs;
  messages: typeof messages;
  progress: typeof progress;
  rateLimit: typeof rateLimit;
  "utils/auth": typeof utils_auth;
  "utils/cache": typeof utils_cache;
  "utils/certificateSignature": typeof utils_certificateSignature;
  "utils/grading": typeof utils_grading;
  "utils/optimisticLocking": typeof utils_optimisticLocking;
  "utils/progressUtils": typeof utils_progressUtils;
  "utils/transactions": typeof utils_transactions;
  "utils/types": typeof utils_types;
  "utils/validation": typeof utils_validation;
  videoProcessing: typeof videoProcessing;
  videos: typeof videos;
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
