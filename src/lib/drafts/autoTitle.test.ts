import { describe, expect, it } from "vitest";

import {
  autoDraftTitle,
  easternStamp,
  isAutoTitle,
  slugPart,
  withOffice,
  UNTITLED
} from "./autoTitle";

// A fixed instant, given in UTC so the Eastern conversion is the thing under
// test rather than an assumption baked into the fixture.
// 2026-08-06 08:30 UTC = 04:30 EDT.
const AUG = new Date("2026-08-06T08:30:00Z");

describe("the name a draft gives itself", () => {
  it("is date, who, where and when", () => {
    expect(
      autoDraftTitle({ now: AUG, displayName: "Amanda Reagan", officeName: "Park West" })
    ).toBe("20260806_AmandaReagan_ParkWest_0430");
  });

  it("stamps Eastern time, not the machine's zone", () => {
    // The server runs in UTC. Taken there, this instant is 08:30 and the title
    // would disagree with the submission stamp on the same note.
    expect(easternStamp(AUG)).toEqual({ date: "20260806", time: "0430" });
  });

  it("resolves standard time as well as daylight time", () => {
    // 2026-01-15 08:30 UTC = 03:30 EST. The offset differs from August's, so a
    // hardcoded -4 would put this in the wrong hour.
    const jan = new Date("2026-01-15T08:30:00Z");
    expect(easternStamp(jan)).toEqual({ date: "20260115", time: "0330" });
  });

  it("keeps the day right when Eastern is still on the previous date", () => {
    // 03:00 UTC on the 7th is 23:00 EDT on the 6th. Using the UTC day would
    // file the note under tomorrow.
    const lateEvening = new Date("2026-08-07T03:00:00Z");
    expect(easternStamp(lateEvening)).toEqual({ date: "20260806", time: "2300" });
  });

  it("pads midnight rather than calling it 24", () => {
    // 04:10 UTC = 00:10 EDT. Some engines format midnight as hour 24.
    expect(easternStamp(new Date("2026-08-06T04:10:00Z")).time).toBe("0010");
  });

  it("leaves the office out when none has been chosen yet", () => {
    // A draft exists before the office select is touched. "Unknown" would read
    // as a recorded fact about the visit rather than an absence.
    expect(autoDraftTitle({ now: AUG, displayName: "Amanda Reagan" })).toBe(
      "20260806_AmandaReagan_0430"
    );
    expect(autoDraftTitle({ now: AUG, displayName: "Amanda Reagan", officeName: null })).toBe(
      "20260806_AmandaReagan_0430"
    );
  });
});

describe("making a name safe to be a filename", () => {
  it("runs the words together in title case", () => {
    expect(slugPart("Amanda Reagan")).toBe("AmandaReagan");
    expect(slugPart("Park West")).toBe("ParkWest");
  });

  it("drops punctuation without dropping letters", () => {
    expect(slugPart("O'Brien-Smith")).toBe("OBrienSmith");
    expect(slugPart("Cornerstone Dental #2")).toBe("CornerstoneDental2");
  });

  it("folds accents instead of deleting the letter", () => {
    // Losing characters out of somebody's name is worse than losing the mark.
    expect(slugPart("Núñez")).toBe("Nunez");
    expect(slugPart("Renée Dubois")).toBe("ReneeDubois");
  });

  it("survives a name that is only punctuation", () => {
    expect(slugPart("!!!")).toBe("");
    expect(autoDraftTitle({ now: AUG, displayName: "!!!" })).toBe("20260806_Unnamed_0430");
  });
});

describe("which titles may be regenerated", () => {
  // The office is usually chosen a moment AFTER the draft exists, so the title
  // has to be rebuilt once it is — but only if the writer has not named the
  // note. This predicate is the entire safety of that.
  it("recognises its own output", () => {
    expect(isAutoTitle("20260806_AmandaReagan_ParkWest_0430")).toBe(true);
    expect(isAutoTitle("20260806_AmandaReagan_0430")).toBe(true);
  });

  it("recognises the old placeholder and an empty title", () => {
    expect(isAutoTitle(UNTITLED)).toBe(true);
    expect(isAutoTitle("   ")).toBe(true);
  });

  it("never claims a name a person typed", () => {
    // THE one that matters. Overwriting somebody's own title is data loss on
    // the only field of the note they get to name.
    for (const typed of [
      "Mrs A — crown seat",
      "20260806 recall",
      "Park West Monday list",
      "Untitled note draft 2",
      "20260806_AmandaReagan_ParkWest_0430 (copy)"
    ]) {
      expect(isAutoTitle(typed), typed).toBe(false);
    }
  });
});

describe("adding the office after the fact", () => {
  it("inserts it without restamping the time the note was started", () => {
    // THE point of the function. The office is picked a minute or two after the
    // draft exists; regenerating from the clock would move the last segment and
    // quietly relabel when the visit began.
    expect(withOffice("20260806_AmandaReagan_0430", "Park West")).toBe(
      "20260806_AmandaReagan_ParkWest_0430"
    );
  });

  it("replaces an office that was already there", () => {
    expect(withOffice("20260806_AmandaReagan_ParkWest_0430", "Fort Sanders")).toBe(
      "20260806_AmandaReagan_FortSanders_0430"
    );
  });

  it("removes it again when the office is cleared", () => {
    expect(withOffice("20260806_AmandaReagan_ParkWest_0430", null)).toBe(
      "20260806_AmandaReagan_0430"
    );
  });

  it("does not touch a title a person typed", () => {
    expect(withOffice("Mrs A — crown seat", "Park West")).toBe("Mrs A — crown seat");
  });

  it("leaves the old placeholder alone rather than inventing a date", () => {
    // There is no start time to preserve, so there is nothing honest to build.
    expect(withOffice(UNTITLED, "Park West")).toBe(UNTITLED);
  });
});
