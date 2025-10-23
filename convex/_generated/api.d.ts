/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as chapters from "../chapters.js";
import type * as contentItems from "../contentItems.js";
import type * as courses from "../courses.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as testQueries from "../testQueries.js";
import type * as users from "../users.js";
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
  auth: typeof auth;
  chapters: typeof chapters;
  contentItems: typeof contentItems;
  courses: typeof courses;
  http: typeof http;
  migrations: typeof migrations;
  testQueries: typeof testQueries;
  users: typeof users;
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
