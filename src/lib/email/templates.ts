import { eventConfig as ev } from "@/config/event";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Shared shell: logo, one message, one button. Emails never carry session details. */
function layout(opts: { greeting: string; paragraphs: string[]; button: { label: string; url: string }; footer: string[] }) {
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${ev.colours.ink}">${t}</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:${ev.colours.paper};font-family:Calibri,Carlito,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ev.colours.paper};padding:32px 16px">
<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;padding:32px">
<tr><td>
<img src="${process.env.NEXT_PUBLIC_SITE_URL}${ev.logo.wordmark}" width="120" alt="${esc(ev.logo.alt)}" style="display:block;margin:0 0 28px">
${p(esc(opts.greeting))}
${opts.paragraphs.map(p).join("\n")}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${ev.colours.brandStrong};border-radius:10px">
<a href="${opts.button.url}" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:bold;font-size:16px;text-decoration:none">${esc(opts.button.label)}</a>
</td></tr></table>
${opts.footer.map((f) => `<p style="margin:0 0 6px;font-size:14px;color:${ev.colours.inkMuted}">${f}</p>`).join("\n")}
</td></tr></table></td></tr></table></body></html>`;
  const text = [opts.greeting, ...opts.paragraphs.map((t) => t.replace(/<[^>]+>/g, "")), `${opts.button.label}: ${opts.button.url}`, ...opts.footer.map((t) => t.replace(/<[^>]+>/g, ""))].join("\n\n");
  return { html, text };
}

export function signInEmail(opts: { name: string; url: string }) {
  return {
    subject: `Your sign-in link for the ${ev.shortName} speaker portal`,
    ...layout({
      greeting: `Hello ${opts.name},`,
      paragraphs: ["Tap the button below to open your speaker portal. The link works once and expires in 24 hours."],
      button: { label: "Open my portal", url: opts.url },
      footer: ["If you didn't ask for this, you can ignore this email.", esc(ev.emailSenderName)],
    }),
  };
}
