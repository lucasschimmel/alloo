import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
export function Avatar({ name, userId }: { name: string; userId?: Id<"users"> }) {
  const source = useQuery(api.profiles.avatar, userId ? { userId } : "skip"),
    read = useAction(api.avatars.read);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let canceled = false;
    let objectUrl: string | undefined;
    setUrl(source?.providerUrl ?? undefined);
    if (source?.storageId && userId)
      void read({ userId })
        .then((bytes) => {
          if (bytes && !canceled) {
            objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
            setUrl(objectUrl);
          }
        })
        .catch(() => {
          if (!canceled) setUrl(undefined);
        });
    return () => {
      canceled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source?.storageId, source?.providerUrl, userId, read]);
  return (
    <span className="avatar" aria-hidden="true">
      {url ? (
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setUrl(undefined)} />
      ) : (
        name.trim().slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
