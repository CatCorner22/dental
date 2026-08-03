export const metadata = { title: "Curve Hero header" };

// Staff asked for the whole note header in one place. Half of it cannot live
// here: patient name, chart number, and the exact date and time of service are
// direct identifiers, and the privacy rule stops every one of them at STOP
// severity. That is not a gap to work around — it is the reason this tool is
// safe to type into.
//
// So the header is split across the two systems that should hold each half, and
// this page says which is which. Staff get the complete header; nobody has to
// guess, and nobody has to test the privacy rule to find out.

interface Row {
  field: string;
  where: "curve" | "smile";
  detail: string;
}

const ROWS: Row[] = [
  {
    field: "Patient name",
    where: "curve",
    detail:
      "A direct identifier. Typing one here is flagged at STOP severity and the note cannot leave the tool until it is removed."
  },
  {
    field: "Patient ID or chart number",
    where: "curve",
    detail: "A direct identifier. Curve Hero already holds it and stamps it for you."
  },
  {
    field: "Date of service",
    where: "curve",
    detail:
      "An exact date beside clinical detail is an identifier. Curve Hero stamps the real one; write relative intervals here — \"in 2 weeks\", not a date."
  },
  {
    field: "Time of the appointment or call",
    where: "curve",
    detail: "Stamped by Curve Hero from the schedule, so it cannot be mistyped."
  },
  {
    field: "Treating provider name and credentials",
    where: "curve",
    detail: "Names, credentials, and signatures never enter Smile Notes."
  },
  {
    field: "Signature and co-signature",
    where: "curve",
    detail:
      "The signature is the legal act. It happens in the record system, on the finished note, by the licensed clinician."
  },
  {
    field: "Office",
    where: "smile",
    detail:
      "Picked per encounter and frozen onto the filed note. It appears at the top of the note you paste."
  },
  {
    field: "Who wrote the draft",
    where: "smile",
    detail:
      "Frozen automatically at file time. Better than a typed field, because nobody can mistype it and nobody can change it afterwards."
  },
  {
    field: "When the draft was filed",
    where: "smile",
    detail:
      "Frozen automatically in Eastern time. This is when the draft was written, which is a different fact from the date of service — Curve Hero supplies that one."
  },
  {
    field: "Encounter type",
    where: "smile",
    detail:
      "The first field in Universal Core. A phone call is a telephone contact, not a teledentistry encounter."
  },
  {
    field: "Contact method",
    where: "smile",
    detail: "How the practice and the patient reached each other: in person, phone, video, portal."
  },
  {
    field: "Urgency",
    where: "smile",
    detail: "Scheduled, urgent, or emergency — the clinician's own judgement."
  },
  {
    field: "Reason for the contact",
    where: "smile",
    detail: "The visit purpose field, in the patient's own de-identified words."
  }
];

export default function Page() {
  const curve = ROWS.filter((r) => r.where === "curve");
  const smile = ROWS.filter((r) => r.where === "smile");

  return (
    <article className="doc">
      <h1>Where each header field goes</h1>
      <p>
        Every note needs a full header. It lives in two systems, and this page says which field
        belongs to which. Smile Notes writes the body; Curve Hero stamps the identity.
      </p>

      <h2>The order of work</h2>
      <ol>
        <li>Write the note in Smile Notes and clear the flags.</li>
        <li>Copy the note.</li>
        <li>Paste it into the Curve Hero note for that patient and appointment.</li>
        <li>Check the patient and the appointment are the right ones before you save.</li>
        <li>Sign it in Curve Hero.</li>
      </ol>
      <p>
        Step 4 is the one that matters. Smile Notes cannot tell you that you have the wrong chart
        open, because it never knows which chart you mean.
      </p>

      <h2>Curve Hero fills these in. Do not type them here.</h2>
      <p>
        Each of these names or dates the patient. Smile Notes flags them, and a note carrying one
        cannot be emailed or downloaded until it is cleared.
      </p>
      <table>
        <thead>
          <tr>
            <th>Header field</th>
            <th>Why it belongs in Curve Hero</th>
          </tr>
        </thead>
        <tbody>
          {curve.map((r) => (
            <tr key={r.field}>
              <td>{r.field}</td>
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Smile Notes supplies these. You do not type them either.</h2>
      <p>
        These are frozen onto the note automatically, or picked from a list. Nothing here is
        free text, so none of it can be mistyped or carried forward from yesterday.
      </p>
      <table>
        <thead>
          <tr>
            <th>Header field</th>
            <th>Where it comes from</th>
          </tr>
        </thead>
        <tbody>
          {smile.map((r) => (
            <tr key={r.field}>
              <td>{r.field}</td>
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Common questions</h2>
      <h3>The note needs a date. Why can I not type one?</h3>
      <p>
        An exact date sitting beside clinical detail is one of the identifiers that makes a record
        traceable to a person. Curve Hero stamps the real date of service on the finished note, so
        nothing is lost. Inside Smile Notes, write the interval instead:{" "}
        <em>in 2 weeks</em>, <em>within 1 business day</em>, <em>at the next scheduled visit</em>.
      </p>
      <h3>I need to say which staff member is doing the follow-up.</h3>
      <p>
        Use the role, not the name — <em>the treatment coordinator</em>, <em>a hygienist</em>. The
        open-items block offers roles as a list for exactly this. A role is also what a later reader
        can act on when that person has left or is off that day.
      </p>
      <h3>Where do I record what the patient was charged?</h3>
      <p>
        Nowhere in this tool, and not in the clinical note at all. Money is handled at the front desk
        and in its own ledger. A conversation only about cost is filed here as a consultation.
      </p>
    </article>
  );
}
