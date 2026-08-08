// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The real action drags NextAuth server code into jsdom; the form only needs
// a server-reference-shaped function to bind to.
vi.mock("@/lib/auth/loginAction", () => ({
  loginAction: vi.fn(async (prev: unknown) => prev)
}));

import { LoginForm } from "./LoginForm";

// What makes this form survive pre-hydration is that a NATIVE submission
// carries everything the server action reads — which happens if and only if
// every field has the exact `name` the action reads from FormData. A silent
// rename on either side is how the defect comes back: the form still works
// hydrated (React passes state, not names), and the no-JS POST quietly loses
// a field. So the names are pinned here as a contract, not as styling.
describe("LoginForm as a native form", () => {
  it("names every field the server action reads", () => {
    const { container } = render(<LoginForm callbackUrl="/notes?tab=filed" />);

    const named = (n: string) => container.querySelector(`[name="${n}"]`);
    expect((named("username") as HTMLInputElement).id).toBe("li-user");
    expect((named("password") as HTMLInputElement).type).toBe("password");
    expect((named("callbackUrl") as HTMLInputElement).value).toBe("/notes?tab=filed");
    expect(named("attempts")).toBeTruthy();
    expect(named("mfaOffered")).toBeTruthy();
  });

  it("submits via the form's action, not an onSubmit handler", () => {
    const { container } = render(<LoginForm />);
    const form = container.querySelector("form")!;
    // React 19 SSRs a server-action form with a real POST wiring; an
    // onsubmit-driven form would leave method as the GET default and lose
    // the fields pre-hydration. jsdom cannot execute the action itself, but
    // it can pin that the form is action-bound.
    expect(form.getAttribute("action") ?? form.action).toBeTruthy();
    expect(form.onsubmit).toBeNull();
  });

  it("does not render the authenticator field before a failure offers it", () => {
    render(<LoginForm />);
    expect(screen.queryByLabelText(/authenticator code/i)).toBeNull();
  });
});
