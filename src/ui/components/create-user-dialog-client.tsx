"use client";

import { CreateUserDialog } from "@/src/ui/components/create-user-dialog";

type AssignableRole =
  | "SACCO_ADMIN"
  | "TREASURER"
  | "LOAN_OFFICER"
  | "AUDITOR"
  | "MEMBER";

export function CreateUserDialogClient({
  allowedRoles,
}: {
  allowedRoles: AssignableRole[];
}) {
  return <CreateUserDialog allowedRoles={allowedRoles} />;
}
