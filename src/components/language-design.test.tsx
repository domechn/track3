import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LanguageDesign } from "./language-design";

it("changes the language through the selected option", () => {
  const onChange = vi.fn();
  render(<LanguageDesign value="en" onChange={onChange} />);
  fireEvent.click(screen.getByRole("radio", { name: /简体中文/ }));
  expect(onChange).toHaveBeenCalledWith("zh");
});
