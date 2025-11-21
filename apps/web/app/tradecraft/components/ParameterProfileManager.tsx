"use client";

import { useState } from "react";
import { Button } from "@eve/ui";
import { Input } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@eve/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eve/ui";
import { Label } from "@eve/ui";
import { Textarea } from "@eve/ui";
import { Save, Loader2, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import {
  useParameterProfiles,
  useCreateParameterProfile,
  useUpdateParameterProfile,
  useDeleteParameterProfile,
  type ParameterProfileScope,
  type ParameterProfile,
} from "../api/parameter-profiles";

interface ParameterProfileManagerProps {
  scope: ParameterProfileScope;
  currentParams: Record<string, unknown>;
  onLoadProfile: (params: Record<string, unknown>) => void;
  className?: string;
}

export function ParameterProfileManager({
  scope,
  currentParams,
  onLoadProfile,
  className = "",
}: ParameterProfileManagerProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] =
    useState<ParameterProfile | null>(null);
  const [error, setError] = useState<string>("");

  // Form state for save dialog
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [isOverwrite, setIsOverwrite] = useState(false);
  const [overwriteProfileId, setOverwriteProfileId] = useState<string>("");

  // API hooks
  const { data: profiles = [], isLoading } = useParameterProfiles(scope);
  const createMutation = useCreateParameterProfile();
  const updateMutation = useUpdateParameterProfile();
  const deleteMutation = useDeleteParameterProfile();

  const handleLoadProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      setSelectedProfileId(profileId);
      onLoadProfile(profile.params);
    }
  };

  const handleOpenSaveDialog = () => {
    setProfileName("");
    setProfileDescription("");
    setIsOverwrite(false);
    setOverwriteProfileId("");
    setError("");
    setSaveDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    setError("");

    if (!isOverwrite && !profileName.trim()) {
      setError("Profile name is required");
      return;
    }

    try {
      if (isOverwrite && overwriteProfileId) {
        // Update existing profile
        await updateMutation.mutateAsync({
          id: overwriteProfileId,
          data: {
            params: currentParams,
          },
        });
      } else {
        // Create new profile
        await createMutation.mutateAsync({
          name: profileName.trim(),
          description: profileDescription.trim() || undefined,
          scope,
          params: currentParams,
        });
      }
      setSaveDialogOpen(false);
      setProfileName("");
      setProfileDescription("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
    }
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;

    try {
      await deleteMutation.mutateAsync({
        id: profileToDelete.id,
        scope: profileToDelete.scope,
      });
      setDeleteDialogOpen(false);
      setProfileToDelete(null);
      if (selectedProfileId === profileToDelete.id) {
        setSelectedProfileId("");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete profile";
      setError(message);
    }
  };

  const openDeleteDialog = (profile: ParameterProfile) => {
    setProfileToDelete(profile);
    setDeleteDialogOpen(true);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Profile Selector */}
      <div className="flex-1 max-w-xs">
        <Select
          value={selectedProfileId}
          onValueChange={handleLoadProfile}
          disabled={isLoading || profiles.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                isLoading
                  ? "Loading profiles..."
                  : profiles.length === 0
                    ? "No profiles saved"
                    : "Select a profile"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save Button */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" onClick={handleOpenSaveDialog}>
            <Save className="h-4 w-4 mr-2" />
            Save Profile
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Parameter Profile</DialogTitle>
            <DialogDescription>
              Save the current parameters as a reusable profile
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Save Mode</Label>
              <Select
                value={isOverwrite ? "overwrite" : "new"}
                onValueChange={(value) => {
                  setIsOverwrite(value === "overwrite");
                  setError("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create New Profile</SelectItem>
                  <SelectItem
                    value="overwrite"
                    disabled={profiles.length === 0}
                  >
                    Overwrite Existing Profile
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isOverwrite ? (
              <div className="space-y-2">
                <Label htmlFor="overwrite-profile">Select Profile</Label>
                <Select
                  value={overwriteProfileId}
                  onValueChange={setOverwriteProfileId}
                >
                  <SelectTrigger id="overwrite-profile">
                    <SelectValue placeholder="Select profile to overwrite" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Profile Name</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g., Conservative Strategy"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-description">
                    Description (optional)
                  </Label>
                  <Textarea
                    id="profile-description"
                    value={profileDescription}
                    onChange={(e) => setProfileDescription(e.target.value)}
                    placeholder="Brief description of this profile..."
                    maxLength={500}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                (isOverwrite && !overwriteProfileId) ||
                (!isOverwrite && !profileName.trim())
              }
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Button - Only show when a profile is selected */}
      {selectedProfileId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const profile = profiles.find((p) => p.id === selectedProfileId);
            if (profile) openDeleteDialog(profile);
          }}
          title="Delete selected profile"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{profileToDelete?.name}
              &rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProfile}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
