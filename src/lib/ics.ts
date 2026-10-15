/**
 * Fichier agenda (.ics, RFC 5545) pour l'échéance d'une opportunité :
 * importable dans Outlook, Google Agenda ou Apple Calendrier, avec rappels 7 jours et 2 jours avant.
 */

/** Échappe le texte selon RFC 5545 (antislash, point-virgule, virgule, retours à la ligne). */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Plie les lignes à 75 octets (continuation par un espace), sans couper un caractère UTF-8. */
export function icsFold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function deadlineIcs(o: { id: string; title: string; deadline: string; url: string; location?: string | null }, now: Date = new Date()): string {
  const end = new Date(o.deadline);
  const start = new Date(end.getTime() - 30 * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LinkProB2B//Echeances//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:echeance-${o.id}@linkprob2b`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(`Échéance : ${o.title}`)}`,
    `DESCRIPTION:${icsEscape(`Date limite de réponse. Vérifiez les modalités sur la fiche : ${o.url}`)}`,
    `URL:${o.url}`,
    ...(o.location ? [`LOCATION:${icsEscape(o.location)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-P7D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape("Échéance dans 7 jours : décision go / no go")}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-P2D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape("Échéance dans 2 jours : finaliser la réponse")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
