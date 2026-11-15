"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { InviteMemberForm } from "@/components/dashboard/profile-forms";

/** Bouton « Ajouter un membre de mon équipe » : formulaire d'invitation (e-mail, poste, rôle) dans une fenêtre. */
export function TeamInvitePanel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="team-add"
        className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 font-semibold text-white shadow-lg shadow-navy/20 transition hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <UserPlus className="size-4 text-teal-200" aria-hidden /> Ajouter un membre de mon équipe
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter un membre de mon équipe" description="Votre collègue reçoit une invitation par e-mail et rejoint l'entreprise dès son inscription avec cette adresse.">
        {open && <InviteMemberForm compact />}
      </Modal>
    </>
  );
}
