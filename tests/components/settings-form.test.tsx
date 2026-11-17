// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsForm } from "@/components/settings-form";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings";

beforeEach(() => {
  window.localStorage.clear();
});

describe("SettingsForm", () => {
  it("saves provider, model, and key, then restores them after a reload", async () => {
    const user = userEvent.setup();
    const first = render(<SettingsForm />);

    const provider = screen.getByLabelText("Provider");
    await waitFor(() => expect(provider).not.toBeDisabled());

    await user.selectOptions(provider, "anthropic");
    const model = screen.getByLabelText("Model");
    await user.clear(model);
    await user.type(model, "claude-opus-4-1");

    const key = screen.getByLabelText("API key");
    expect(key).toHaveAttribute("type", "password");
    await user.type(key, "sk-ant-super-secret");
    expect(key).toHaveValue("sk-ant-super-secret");

    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(screen.getByRole("status")).toHaveTextContent(/saved/i);

    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(stored).toContain("anthropic");
    expect(stored).toContain("claude-opus-4-1");
    expect(stored).toContain("sk-ant-super-secret");

    first.unmount();

    render(<SettingsForm />);
    await waitFor(() =>
      expect(screen.getByLabelText("API key")).toHaveValue(
        "sk-ant-super-secret",
      ),
    );
    expect(screen.getByLabelText("Provider")).toHaveValue("anthropic");
    expect(screen.getByLabelText("Model")).toHaveValue("claude-opus-4-1");
    expect(screen.getByLabelText("API key")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("clears saved settings from the browser", async () => {
    const user = userEvent.setup();
    render(<SettingsForm />);
    await waitFor(() =>
      expect(screen.getByLabelText("Provider")).not.toBeDisabled(),
    );

    await user.type(screen.getByLabelText("API key"), "sk-to-delete");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    expect(screen.getByLabelText("API key")).toHaveValue("");
  });
});
