export function ContactLinks({
  name,
  whatsapp,
  phone,
  className = "",
}: {
  name: string;
  whatsapp: string | null;
  phone: string | null;
  className?: string;
}) {
  const wa = whatsapp ? (whatsapp.startsWith("http") ? whatsapp : `https://wa.me/${whatsapp.replace(/\D/g, "")}`) : null;
  if (!wa && !phone) return null;
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {wa && (
        <a
          href={wa}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#1F7A4D] px-5 font-semibold text-white"
          aria-label={`WhatsApp ${name}`}
        >
          WhatsApp
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-5 font-semibold"
          aria-label={`Call ${name}`}
        >
          Call
        </a>
      )}
    </div>
  );
}
