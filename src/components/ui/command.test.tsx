import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
});

describe("Command", () => {
  it("keeps input focus while keyboard navigation selects an item", async () => {
    const user = userEvent.setup();
    const selectApple = vi.fn();
    const selectBitcoin = vi.fn();

    render(
      <Command>
        <CommandInput aria-label="Search assets" />
        <CommandList>
          <CommandItem value="Apple" onSelect={selectApple}>
            Apple
          </CommandItem>
          <CommandItem value="Bitcoin" onSelect={selectBitcoin}>
            Bitcoin
          </CommandItem>
        </CommandList>
      </Command>,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    expect(input).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("Bitcoin")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(input).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(selectBitcoin).toHaveBeenCalledWith("Bitcoin");
    expect(selectApple).not.toHaveBeenCalled();
  });
});
