import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "Reconcile orphaned avatars and expired presence",
  { hours: 1 },
  internal.maintenance.sweep,
  {},
);
export default crons;
