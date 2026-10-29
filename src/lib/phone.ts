// WhatsApp needs the full international number as digits only (wa.me/971501234567).
// Returns null when we can't be sure of the country code, so we never open the wrong chat.
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
