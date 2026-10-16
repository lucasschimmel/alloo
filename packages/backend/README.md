# Convex backend

Functions, schema, auth and scheduled jobs live in convex/. Run CLI commands at the repository root, where convex.json selects this directory. Export only generated api and dataModel subpaths to frontend consumers.

Private projection/invitation services, pagination and Node image codecs live in src/. They are not additional public endpoints. Shared test accounts live in test-support.ts and are imported only by tests.
