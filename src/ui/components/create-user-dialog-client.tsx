"use client";

import { CreateUserDialog } from "@/src/ui/components/create-user-dialog";
import { type SaccoRole } from "@/src/lib/roles";

export function CreateUserDialogClient({
  allowedRoles,
}: {
  allowedRoles: SaccoRole[];
}) {
  return <CreateUserDialog allowedRoles={allowedRoles} />;
}
