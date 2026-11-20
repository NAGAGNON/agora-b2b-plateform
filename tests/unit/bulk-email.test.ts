import { afterEach, describe, expect, it, vi } from "vitest";

const sendSmtp = vi.fn();
vi.mock("@/lib/email/smtp", () => ({ sendSmtp: (m: unknown) => sendSmtp(m) }));
import { sendEmail } from "@/lib/email/send";

function setup() {
  vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
  vi.stubEnv("SMTP_USER", "fondateur@gmail.com");
  vi.stubEnv("SMTP_PASSWORD", "x");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_TRANSPORT", "resend");
  vi.stubEnv("EMAIL_FROM", "LinkProB2B <fondateur@gmail.com>");
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "r1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sendSmtp.mockReset();
});

describe("e-mails envoyés en nombre", () => {
  const msg = { to: "a@b.fr", subject: "S", html: "<p>x</p>", text: "x", fromName: "LinkProB2B | Veille commerciale", headers: { "List-Unsubscribe": "<https://x>" } };

  it("passent par le SMTP d'abord, sans toucher au quota Resend, avec le nom d'expéditeur", async () => {
    const fetchMock = setup();
    sendSmtp.mockResolvedValue({ status: "SENT", id: "s1" });
    expect(await sendEmail({ ...msg, bulk: true })).toMatchObject({ status: "SENT", id: "s1" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendSmtp.mock.calls[0][0]).toMatchObject({ from: '"LinkProB2B | Veille commerciale" <fondateur@gmail.com>', headers: { "List-Unsubscribe": "<https://x>" } });
  });

  it("si le SMTP échoue, Resend prend le relais", async () => {
    const fetchMock = setup();
    sendSmtp.mockResolvedValue({ status: "FAILED", error: "quota Gmail", retryable: true });
    expect(await sendEmail({ ...msg, bulk: true })).toMatchObject({ status: "SENT", id: "r1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("les e-mails importants restent sur Resend", async () => {
    const fetchMock = setup();
    expect((await sendEmail(msg)).status).toBe("SENT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sendSmtp).not.toHaveBeenCalled();
  });
});
