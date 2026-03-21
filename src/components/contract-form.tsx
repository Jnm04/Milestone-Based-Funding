"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ContractFormProps {
  investorAddress: string;
}

export function ContractForm({ investorAddress }: ContractFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    milestone: "",
    amountUSD: "",
    deadlineDays: "30",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.milestone || !form.amountUSD) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const cancelAfter = new Date(
        Date.now() + Number(form.deadlineDays) * 24 * 60 * 60 * 1000
      ).toISOString();

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorAddress,
          milestone: form.milestone,
          amountUSD: form.amountUSD,
          cancelAfter,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create contract");
      }

      const { contractId } = await res.json();
      toast.success("Contract created! Redirecting…");
      router.push(`/contract/${contractId}?investor=${investorAddress}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="milestone">Milestone</Label>
        <Textarea
          id="milestone"
          placeholder="Describe exactly what the startup must deliver to receive payment…"
          rows={4}
          value={form.milestone}
          onChange={(e) => update("milestone", e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Be specific — Claude AI will compare the uploaded proof against this description.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Amount (USD)</Label>
          <Input
            id="amount"
            type="number"
            min="1"
            step="0.01"
            placeholder="500.00"
            value={form.amountUSD}
            onChange={(e) => update("amountUSD", e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Locked as RLUSD (1:1 peg)</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deadline">Deadline (days)</Label>
          <Input
            id="deadline"
            type="number"
            min="1"
            max="365"
            placeholder="30"
            value={form.deadlineDays}
            onChange={(e) => update("deadlineDays", e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">After this: auto-refund</p>
        </div>
      </div>

      <Button type="submit" disabled={loading} size="lg">
        {loading ? "Creating…" : "Create Contract"}
      </Button>
    </form>
  );
}
