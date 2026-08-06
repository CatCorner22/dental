import Link from "next/link";
import { Character } from "@/components/mascot/Sparkle";
import { daySeed, sparkleLine } from "@/lib/stats/sparkle";

// A wrong turn has already been the unhelpful part of someone's experience.
// Sparkle replaces the bare tooth emoji that used to stand in for her here, and
// the line is written to soften rather than to explain again.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mb-3 flex justify-center">
        <Character id="sparkle" size="lg" />
      </div>
      <h1 className="mb-2 text-xl font-bold">Page not found</h1>
      <p className="mb-2 text-sm text-slate-600">
        This page does not exist, or you do not have access to it.
      </p>
      <p className="mb-6 text-sm text-slate-500">{sparkleLine("lost", daySeed(new Date()))}</p>
      <Link className="btn-primary inline-flex" href="/">
        Back to your note
      </Link>
    </div>
  );
}
