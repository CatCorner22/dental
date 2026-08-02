export interface EmailConfig {
  configured: boolean;
  apiKey?: string;
  from?: string;
  corporateEmail?: string;
}

// The corporate recipient comes only from the server environment.
// No request can ever choose or add a recipient.
export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const corporateEmail = process.env.CORPORATE_EMAIL?.trim();
  const configured = Boolean(apiKey && from && corporateEmail);
  return {
    configured,
    apiKey: apiKey || undefined,
    from: from || undefined,
    corporateEmail: corporateEmail || undefined
  };
}
