"use client"

import { useState } from "react"
import { IconX } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { CreateUserForm } from "@/src/ui/forms/create-user-form"

type CreateUserDialogProps = {
  allowedRoles: Array<"SACCO_ADMIN" | "TREASURER" | "LOAN_OFFICER" | "AUDITOR" | "MEMBER">
}

export function CreateUserDialog({ allowedRoles }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="ml-auto">
      <Button type="button" onClick={() => setOpen((value) => !value)}>
        Add User
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Add User">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setOpen(false)}
            aria-label="Close add user drawer"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl border-l bg-card shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">Add User</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a new user account and assign the right role.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Close add user drawer"
                >
                  <IconX className="size-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-4">
                <CreateUserForm
                  inDialog
                  allowedRoles={allowedRoles}
                  onSuccess={() => setOpen(false)}
                />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
