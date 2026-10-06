import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  INTEREST_STATUS_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PIPELINE_LABELS,
  PROPOSAL_STATUS_LABELS,
  REPORT_STATUS_LABELS,
  SOURCE_STATUS_LABELS,
  type InterestStatus,
  type OpportunityStatus,
  type PipelineStage,
  type ProposalStatus,
  type ReportStatus,
  type SourceStatus,
} from "@/lib/constants";

const OPP_TONES: Record<string, BadgeTone> = {
  DRAFT: "slate",
  PENDING_REVIEW: "amber",
  CHANGES_REQUESTED: "amber",
  REJECTED: "red",
  PUBLISHED: "green",
  CLOSED: "navy",
  EXPIRED: "slate",
  SUSPENDED: "red",
  ARCHIVED: "outline",
};

type Props =
  | { kind: "opportunity"; status: OpportunityStatus | string }
  | { kind: "interest"; status: InterestStatus }
  | { kind: "proposal"; status: ProposalStatus }
  | { kind: "pipeline"; status: PipelineStage }
  | { kind: "report"; status: ReportStatus }
  | { kind: "source"; status: SourceStatus }
  | { kind: "account"; status: string };

const GENERIC: Record<string, BadgeTone> = {
  PENDING: "amber",
  SHORTLISTED: "violet",
  INFO_REQUESTED: "amber",
  ACCEPTED: "green",
  SELECTED: "green",
  DECLINED: "red",
  WITHDRAWN: "outline",
  SUBMITTED: "sky",
  WON: "green",
  LOST: "red",
  OPEN: "amber",
  REVIEWING: "sky",
  RESOLVED: "green",
  DISMISSED: "outline",
  APPROVED: "green",
  LEGAL_REVIEW: "amber",
  ACTIVE: "green",
  SUSPENDED: "red",
  DELETED: "outline",
};

/** Badge de statut unifié (couleur + libellé, jamais la couleur seule). */
export function StatusBadge(props: Props) {
  const { kind, status } = props;
  let label: string = status;
  let tone: BadgeTone = GENERIC[status] ?? "slate";
  switch (kind) {
    case "opportunity":
      label = OPPORTUNITY_STATUS_LABELS[status as OpportunityStatus] ?? status;
      tone = OPP_TONES[status] ?? "slate";
      break;
    case "interest":
      label = INTEREST_STATUS_LABELS[status];
      break;
    case "proposal":
      label = PROPOSAL_STATUS_LABELS[status];
      break;
    case "pipeline":
      label = PIPELINE_LABELS[status];
      tone = GENERIC[status] ?? "sky";
      break;
    case "report":
      label = REPORT_STATUS_LABELS[status];
      break;
    case "source":
      label = SOURCE_STATUS_LABELS[status];
      break;
    case "account":
      label = status === "ACTIVE" ? "Actif" : status === "SUSPENDED" ? "Suspendu" : status === "PENDING" ? "En attente" : "Supprimé";
      break;
  }
  return <Badge tone={tone}>{label}</Badge>;
}
