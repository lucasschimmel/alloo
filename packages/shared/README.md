# Shared domain code

Policies, validators, release checks and display contracts. Use explicit @alloo/shared subpaths. No imports from apps or generated backend schemas. Tests live beside modules.

HTTP response policy is shared by both Workers. Node codecs and Convex pagination belong to backend/src; shared has neither dependency. Test files and implementation internals are not public exports.
