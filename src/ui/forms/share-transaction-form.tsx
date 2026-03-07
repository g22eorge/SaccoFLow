"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/src/lib/money";
import { formatMemberLabel } from "@/src/lib/member-label";

type MemberOption = {
  id: string;
  fullName: string;
  memberNumber: string;
  shareBalance: string;
};

export function ShareTransactionForm({
  members,
}: {
  members: MemberOption[];
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<"PURCHASE" | "REDEMPTION" | "ADJUSTMENT">("PURCHASE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === memberId),
    [memberId, members],
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId,
          amount: Number(amount),
          type,
          note: note || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Failed to record share transaction");
      }

      setMessage(`${type} recorded.`);
      setAmount("");
      setNote("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unexpected error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border bg-card p-6"
    >
      <h2 className="text-lg font-semibold">Record Share Transaction</h2>
      <p className="text-sm text-muted-foreground">
        Capture share purchases, redemptions, and adjustments as SACCO capital movements.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {formatMemberLabel(member.memberNumber, member.fullName)}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(event) =>
            setType(event.target.value as "PURCHASE" | "REDEMPTION" | "ADJUSTMENT")
          }
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="PURCHASE">Purchase</option>
          <option value="REDEMPTION">Redemption</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>
        <input
          required
          min={0.01}
          step="0.01"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Amount"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Note (optional)"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Current share balance: {" "}
        <span className="font-semibold text-foreground">
          {selectedMember ? formatMoney(selectedMember.shareBalance) : "-"}
        </span>
      </p>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {loading ? "Saving..." : "Submit"}
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
