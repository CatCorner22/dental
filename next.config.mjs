/** @type {import('next').NextConfig} */

// Security headers.
//
// These are the browser-enforced half of the app's defences: the server can
// refuse a bad request, but only the browser can stop a page being framed,
// stop a MIME sniff turning an upload into a script, or stop a token leaking
// into a third-party Referer. Set once, here, so no route can forget them.
//
// The CSP is deliberately strict about where code and data may come from, and
// deliberately honest about what Next.js needs:
//
//   'unsafe-inline' on script-src — Next's App Router inlines its hydration
//   bootstrap and flight data as inline <script> tags. Removing it requires a
//   per-request nonce threaded through the framework's own script tags, which
//   Next does not expose on a static header. Documented rather than hidden:
//   the app renders no user-supplied HTML anywhere, so the XSS surface this
//   would defend is not currently reachable.
//
//   'unsafe-eval' is NOT granted in production. PGlite's WASM loader wants it
//   in development only; a production deployment uses node-postgres.
//
//   connect-src 'self' — the app makes no third-party requests at all. Email
//   goes out server-side. If that ever changes, this line must change with it,
//   which is the point.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind emits a stylesheet, but styled-jsx and inline style attributes
  // still need this. No external stylesheet host is allowed.
  "style-src 'self' 'unsafe-inline'",
  // data: covers the inline SVG favicon; blob: covers the client-side note
  // export, which builds a Blob URL to download the frozen record.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // No blob: here on purpose. Downloading an exported note DOES create a blob:
  // URL, but it is only ever assigned to an <a download> href — it is never
  // fetched — and connect-src governs fetch/XHR/WebSocket, not a download
  // navigation. Granting blob: would widen the policy for a request the app
  // does not make. (This comment used to sit two lines lower, under object-src,
  // where it read as a justification for a directive it had nothing to do with.)
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  // The app posts only to itself; mailto: is the feedback link.
  "form-action 'self'",
  // Clickjacking: nothing here should ever be framed.
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'"
  // NO upgrade-insecure-requests. It was here and it broke everything served
  // over plain HTTP: the directive rewrites every http:// request to https://,
  // so a build running on http://127.0.0.1:3000 — CI, a local run, or a
  // practice's internal box before TLS is set up — fails with
  // ERR_SSL_PROTOCOL_ERROR and never finishes navigating. Chromium and WebKit
  // apply it to loopback; Firefox exempts loopback, which is why only two of
  // the three browsers caught it.
  //
  // It also buys nothing here. The directive exists to upgrade http:// SUBRESOURCE
  // URLs embedded in a page, and this app embeds none — default-src and
  // connect-src are both 'self', there is no CDN, no external font, no remote
  // image. HSTS below is what actually forces HTTPS on a real deployment, and
  // it does so without breaking one that has not got TLS yet.
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt and braces with frame-ancestors, for anything that predates CSP 2.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A password-reset token lives in a URL path. Sending a full URL to another
  // origin as a Referer would leak it; this sends nothing cross-origin.
  { key: "Referrer-Policy", value: "no-referrer" },
  // Deny device APIs the app does not use. Microphone is the exception:
  // Standardize dictation (browser SpeechRecognition) must be able to prompt
  // on this origin. `microphone=(self)` allows same-origin only — embedded
  // third parties and a compromised cross-origin frame still cannot ask.
  // Camera and the rest stay fully denied so an operatory tab cannot be
  // quietly turned into a silent camera.
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=(self)",
      "payment=()",
      "usb=()",
      "interest-cohort=()"
    ].join(", ")
  },
  // Two years, subdomains included. Only meaningful over HTTPS; a browser
  // ignores it on a plain-HTTP origin, so the header itself is safe to send
  // unconditionally.
  //
  // `preload` is NOT sent by default, because it is the one part of this that
  // is not reversible. Advertising it invites submission to the browsers'
  // built-in preload list, and an entry there is compiled into shipped browser
  // binaries: with includeSubDomains, EVERY subdomain becomes HTTPS-only for
  // everyone, and removal takes months to propagate. That is a fine commitment
  // for a finished public domain and a trap for a practice that later needs
  // http://intranet.example.com, or for anyone forking this. An operator who
  // has read that sentence and means it sets HSTS_PRELOAD=1.
  {
    key: "Strict-Transport-Security",
    value: `max-age=63072000; includeSubDomains${process.env.HSTS_PRELOAD === "1" ? "; preload" : ""}`
  },
  // Cross-origin isolation primitives. These stop another origin from reading
  // this one's resources or holding a reference to its window.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" }
];

const nextConfig = {
  // PGlite ships a WASM bundle whose loader resolves data files via import.meta
  // URLs; webpack bundling breaks that. Keep the DB drivers external so they
  // load from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: {
    "/reference/**": ["./skill/**"]
  },
  // Next advertises its version in a response header. It tells an attacker
  // which CVEs to try and tells a legitimate user nothing.
  poweredByHeader: false,
  async redirects() {
    return [
      {
        // /standardize was a top-level destination for the life of the app, so
        // it is in bookmarks and pasted into chat. Its whole job — checking
        // wording, sorting prose into sections, resolving what the checker
        // raises — happens inside the note now. Permanent, because it is not
        // coming back.
        source: "/standardize",
        destination: "/",
        permanent: true
      }
    ];
  },
  async headers() {
    return [
      {
        // Everything, including API routes and static assets.
        source: "/:path*",
        headers: securityHeaders
      },
      {
        // A password-reset link must never be cached — not by the browser, not
        // by a proxy, not in a shared-workstation back button.
        source: "/reset/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          ...securityHeaders
        ]
      }
    ];
  }
};

export default nextConfig;
