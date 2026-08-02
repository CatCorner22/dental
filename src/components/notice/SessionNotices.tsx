"use client";

import { useState } from "react";
import { NoticeGate } from "./NoticeGate";
import { FeedbackNotice } from "./FeedbackNotice";

// Owns the ordering of the two things shown at the start of a session.
//
// These cannot be two independent siblings reading the same server prop: the
// legal gate is acknowledged on the CLIENT, and nothing re-renders the layout
// afterwards, so a component gated on the server's `noticeAcked` would still
// see `false` for the rest of the visit. On a brand-new account that meant the
// feedback reminder never appeared on the very login it is meant for.
// Holding the flag here lets the gate hand off directly.
export function SessionNotices({ acknowledged }: { acknowledged: boolean }) {
  const [acked, setAcked] = useState(acknowledged);
  return (
    <>
      <NoticeGate acknowledged={acknowledged} onAcknowledged={() => setAcked(true)} />
      {/* Strictly after the legal gate — the two must never be on screen at
          once, and the one that blocks the app comes first. */}
      <FeedbackNotice enabled={acked} />
    </>
  );
}
