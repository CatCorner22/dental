import { describe, it, expect } from "vitest";
import { standardize } from "./standardize";

function show(label: string, input: string) {
  const once = standardize(input);
  const twice = standardize(once.text);
  // eslint-disable-next-line no-console
  console.log(
    `\n### ${label}\n  IN    : ${JSON.stringify(input)}\n  ONCE  : ${JSON.stringify(once.text)}\n  TWICE : ${JSON.stringify(twice.text)}\n  IDEMP : ${once.text === twice.text}\n  FLAGS : ${JSON.stringify(once.flags.map((f) => f.display))}\n  APPLY : ${JSON.stringify(once.applied.map((a) => `${a.from}->${a.to} x${a.count}`))}`
  );
  return { once, twice };
}

describe("A. idempotency probes", () => {
  const cases = [
    ["BWX", "BWX taken of the posterior teeth"],
    ["BW", "BW taken of the posterior teeth"],
    ["BWs plural", "BWs taken today"],
    ["FMS", "FMS reviewed"],
    ["FMX", "FMX reviewed"],
    ["pano lower", "pano reviewed"],
    ["PANO upper", "PANO reviewed"],
    ["PAN", "PAN reviewed"],
    ["VDO", "VDO measured at rest"],
    ["OVD", "OVD measured at rest"],
    ["b.i.d. dotted", "amoxicillin 500mg b.i.d. for 7 days"],
    ["bid plain", "ibuprofen 600mg bid for 3 days"],
    ["t.i.d. dotted", "ibuprofen 600 mg t.i.d. for 3 days"],
    ["p.r.n. dotted", "ibuprofen p.r.n. pain"],
    ["prn plain", "ibuprofen prn pain"],
    ["f/u lower", "f/u in 2 weeks"],
    ["F/U upper", "F/U in 2 weeks"],
    ["n2o lower", "n2o given at 30%"],
    ["N2O upper", "N2O given at 30 percent"],
    ["rct lower", "rct started on #14"],
    ["RCT upper", "RCT started on #14"],
    ["Rct title", "Rct started on #14"],
    ["NKA", "NKA per patient"],
    ["NKDA", "NKDA per patient"],
    ["already defined", "Root canal therapy (RCT) started. RCT completed later."],
    ["already defined lower", "root canal therapy (rct) started"],
    ["preexisting paren only", "The (RCT) was completed"],
    ["x-rays plural", "Two x-rays were taken"],
    ["x-ray singular", "One x-ray was taken"],
    ["I&D", "Performed I&D of the buccal space"],
    ["trailing comma", "no bleeding,"],
    ["colon list", "Findings: caries, calculus"]
  ] as const;

  for (const [label, input] of cases) {
    it(`idempotent: ${label}`, () => {
      const { once, twice } = show(label, input);
      expect(twice.text, `NOT IDEMPOTENT for ${label}`).toBe(once.text);
    });
  }
});
