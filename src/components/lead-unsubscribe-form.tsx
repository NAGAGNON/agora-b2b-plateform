"use client";

import { useActionState } from "react";
import { unsubscribeAlertLead } from "@/app/actions/alert-leads";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

export function LeadUnsubscribeForm({ token }: { token: string }) {
  const [state, action] = useActionState(unsubscribeAlertLead, null);
  if (state) return <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>;
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <SubmitButton>Confirmer la désinscription</SubmitButton>
    </form>
  );
}
