import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { I18nProvider, localeLocalStorageKey } from "@/i18n";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";

afterEach(() => localStorage.removeItem(localeLocalStorageKey));

it("localizes the dialog close control", () => {
  localStorage.setItem(localeLocalStorageKey, "zh");
  render(
    <I18nProvider>
      <Dialog defaultOpen>
        <DialogTrigger>打开</DialogTrigger>
        <DialogContent>
          <DialogTitle>标题</DialogTitle>
        </DialogContent>
      </Dialog>
    </I18nProvider>,
  );
  expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
});
