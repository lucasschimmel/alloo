"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, User } from "lucide-react";

export default function SetupProfilePage() {
  const { user, isLoading } = useCurrentUser();
  const updateProfile = useMutation(api.users.updateProfile);
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If user already has a username, skip to onboarding or chat
  if (!isLoading && user?.username) {
    if (!user.onboardingCompleted) {
      router.replace("/onboarding");
    } else {
      router.replace("/chat");
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (username.length < 3) {
      setError("3 caractères minimum pour le username");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Lettres, chiffres et underscores uniquement");
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        username,
        displayName: displayName || undefined,
        bio: bio || undefined,
      });
      router.replace("/onboarding");
    } catch (err: any) {
      setError(err.message ?? "Ce username est déjà pris");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Configure ton profil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comment les autres te verront sur Alloo
          </p>
        </div>

        {/* Avatar placeholder */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <User className="h-10 w-10 text-primary" />
            </div>
            <button
              type="button"
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
              title="Bientôt disponible"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username (required) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Username <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                type="text"
                placeholder="ton_username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))
                }
                className="pl-8"
                minLength={3}
                maxLength={20}
                required
                autoFocus
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              3-20 caractères · lettres, chiffres, _
            </p>
          </div>

          {/* Display Name (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Nom d&apos;affichage
            </label>
            <Input
              type="text"
              placeholder={user?.name ?? "Comment tu veux qu'on t'appelle"}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Bio (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bio</label>
            <textarea
              placeholder="Dis quelque chose sur toi..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            <p className="mt-0.5 text-right text-xs text-muted-foreground">
              {bio.length}/160
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : "Continuer"}
          </Button>
        </form>
      </div>
    </div>
  );
}
