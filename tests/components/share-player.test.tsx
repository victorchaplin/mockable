// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharePlayer } from "@/components/share-player";
import type { PageDTO } from "@/lib/types";

const HOME: PageDTO = {
  id: "home",
  name: "home",
  title: "Home",
  isEntry: true,
  html: '<!DOCTYPE html><html><body><h1>Entry page</h1><a href="page://checkout">Checkout</a></body></html>',
};

const CHECKOUT: PageDTO = {
  id: "checkout",
  name: "checkout",
  title: "Checkout",
  isEntry: false,
  html: '<!DOCTYPE html><html><body><h1>Checkout page</h1></body></html>',
};

function frameContent(): string {
  return screen.getByTestId("preview-frame").getAttribute("srcdoc") ?? "";
}

describe("SharePlayer", () => {
  it("renders the entry page with player chrome", () => {
    render(
      <SharePlayer
        projectName="Booking flow"
        pages={[HOME, CHECKOUT]}
        initialPageId="home"
      />,
    );

    expect(screen.getByText("Booking flow")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Prototype pages" });
    expect(nav).toBeInTheDocument();
    expect(frameContent()).toContain("Entry page");
    expect(screen.getByTestId("preview-frame")).toHaveAttribute(
      "sandbox",
      "allow-scripts",
    );
  });

  it("switches pages from the switcher and from in-flow links", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SharePlayer
        projectName="Booking flow"
        pages={[HOME, CHECKOUT]}
        initialPageId="home"
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Checkout" }));
    expect(frameContent()).toContain("Checkout page");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "mockable:navigate", page: "home" },
      }),
    );
    await waitFor(() => expect(frameContent()).toContain("Entry page"));

    // The player is fully client-side: no API calls while walking the flow.
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
