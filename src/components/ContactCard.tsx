import { ContactLinks } from "@/components/ContactLinks";

export function ContactCard({ name, phone, whatsapp }: { name: string; phone: string | null; whatsapp: string | null }) {
  return (
    <section aria-labelledby="contact-h" className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
      <h2 id="contact-h" className="font-display text-xl font-semibold">
        Questions?
      </h2>
      <p className="mt-1 text-[0.95rem] text-ink-muted">
        Message <span className="font-semibold text-ink">{name}</span>, any time before or during the forum.
      </p>
      <ContactLinks name={name} phone={phone} whatsapp={whatsapp} className="mt-4" />
    </section>
  );
}
