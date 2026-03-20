"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Copy, Link, LogOut, QrCode, UserMinus, X } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface GroupInfoProps {
  conversation: {
    _id: Id<"conversations">;
    name?: string;
    inviteCode?: string;
    members: Array<{
      _id: Id<"users">;
      username?: string;
      name?: string;
      isOnline: boolean;
      role: string;
    } | null>;
    currentUserRole: string;
  };
  onClose: () => void;
}

export function GroupInfo({ conversation, onClose }: GroupInfoProps) {
  const leaveGroup = useMutation(api.conversations.leaveGroup);
  const removeMember = useMutation(api.conversations.removeMember);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteUrl = conversation.inviteCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${conversation.inviteCode}`
    : null;

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    await leaveGroup({ conversationId: conversation._id });
  };

  const handleRemove = async (userId: Id<"users">) => {
    await removeMember({ conversationId: conversation._id, userId });
  };

  return (
    <div className="w-72 border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="text-sm font-semibold">Info du groupe</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100%-57px)]">
        <div className="space-y-4 p-4">
          <div className="text-center">
            <h4 className="text-lg font-semibold">{conversation.name}</h4>
            <p className="text-sm text-muted-foreground">
              {conversation.members.length} membres
            </p>
          </div>

          {/* Invite */}
          {inviteUrl && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium uppercase text-muted-foreground">
                Invitation
              </h5>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    "Copié !"
                  ) : (
                    <>
                      <Link className="mr-1.5 h-3 w-3" />
                      Copier le lien
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowQR(!showQR)}
                >
                  <QrCode className="h-3.5 w-3.5" />
                </Button>
              </div>
              {showQR && (
                <div className="flex justify-center rounded-lg border bg-white p-4">
                  <QRCodeSVG value={inviteUrl} size={160} />
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Members */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium uppercase text-muted-foreground">
              Membres
            </h5>
            {conversation.members
              .filter(Boolean)
              .map((member) => (
                <div
                  key={member!._id}
                  className="flex items-center gap-2 rounded-lg p-1.5"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {(member!.username ?? "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {member!.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm">
                      {member!.username ?? member!.name}
                    </span>
                    {member!.role === "admin" && (
                      <span className="ml-1.5 text-xs text-primary">admin</span>
                    )}
                  </div>
                  {conversation.currentUserRole === "admin" &&
                    member!.role !== "admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemove(member!._id)}
                      >
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    )}
                </div>
              ))}
          </div>

          <Separator />

          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={handleLeave}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Quitter le groupe
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}
