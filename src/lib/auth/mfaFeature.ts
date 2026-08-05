// Deployment-level switch for authenticator-app (TOTP) second factors.
//
// OFF unless MFA_ENABLED=1. A second factor is only a safety feature while
// someone can recover from losing it; on a deployment whose ONLY Developer
// enrolls and then loses the device, there is nobody left to reset it and the
// break-glass env path is the sole way back in (a live lockout proved this the
// week the site launched). Until the practice has a second Developer or
// working reset email, the trap stays disarmed by default.
//
// While OFF:
//   - login never asks for or checks a code, even for accounts with stale
//     enrollment rows;
//   - enrollment/confirm/disable via /api/me/mfa refuses;
//   - the account page hides the section, the login form hides the code field;
//   - bootstrap clears any leftover enrollments so re-enabling later starts
//     clean instead of instantly re-locking whoever enrolled before.
export function mfaFeatureEnabled(): boolean {
  return process.env.MFA_ENABLED?.trim() === "1";
}
