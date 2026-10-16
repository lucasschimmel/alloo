import { api } from "@alloo/backend/api";
import type { Id } from "@alloo/backend/dataModel";
import { attachmentName } from "@alloo/shared/attachments";
import { LIMITS } from "@alloo/shared/policy";
import { useAuthToken } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { explain } from "../../lib/errors";
export type Attached = { id: Id<"attachments">; name: string; size: number };
export async function fetchAttachment(
  endpoint: string,
  token: string,
  params: Record<string, string>,
  file?: File,
  signal?: AbortSignal,
) {
  const response = await fetch(`${endpoint}/attachments?${new URLSearchParams(params)}`, {
    method: file ? "POST" : "GET",
    body: file,
    headers: { Authorization: `Bearer ${token}` },
    signal: signal,
  });
  if (!response.ok) {
    if (response.status === 413) throw new Error("ATTACHMENT_TOO_LARGE");
    if (response.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(file ? "INVALID_ATTACHMENT" : "FORBIDDEN");
  }
  if (file) return { uploaded: (await response.json()) as Attached, blob: null };
  return { uploaded: null, blob: await response.blob() };
}
export function useAttachmentTransfer() {
  const token = useAuthToken(),
    endpoint = useQuery(api.attachmentRecords.endpoint, {});
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function request(params: Record<string, string>, file?: File) {
    if (!token || !endpoint) throw new Error("UNAUTHENTICATED");
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(() => controller.abort(), LIMITS.attachmentUploadMs);
    try {
      return await fetchAttachment(endpoint, token, params, file, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    ready: !!token && !!endpoint,
    upload: async (id: Id<"conversations">, file: File) => {
      const name = attachmentName(file.name);
      if (!file.size || file.size > LIMITS.attachmentBytes) throw new Error("INVALID_ATTACHMENT");
      const result = await request({ conversation: id, name }, file);
      if (!result.uploaded) throw new Error("INVALID_ATTACHMENT");
      return result.uploaded;
    },
    download: async (id: Id<"attachments">) => (await request({ id })).blob,
  };
}
export function AttachmentDownload({
  file,
  notify,
}: {
  file: Attached;
  notify: (message: string) => void;
}) {
  const { download } = useAttachmentTransfer();
  const [busy, setBusy] = useState(false);
  const objectUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className="attachment-download"
      disabled={busy}
      aria-label={`Télécharger ${file.name}`}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const blob = await download(file.id);
          if (!blob) throw new Error("NOT_FOUND");
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          const url = URL.createObjectURL(blob);
          objectUrl.current = url;
          const link = document.createElement("a");
          link.href = url;
          link.download = file.name;
          document.body.append(link);
          link.click();
          link.remove();
        } catch (error) {
          notify(explain(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download size={16} />
      <span>
        {busy ? "Téléchargement…" : file.name}
        <small>{Math.ceil(file.size / 1024)} Ko</small>
      </span>
    </button>
  );
}
