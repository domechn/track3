import { useState } from "react";

type PassphraseKind = "export" | "import" | "legacy";

export function usePassphraseRequest() {
  const [request, setRequest] = useState<{
    kind: PassphraseKind;
    resolve: (passphrase: string | undefined) => void;
  }>();
  const [passphrase, setPassphrase] = useState("");

  function ask(kind: PassphraseKind): Promise<string | undefined> {
    return new Promise((resolve) => {
      setPassphrase("");
      setRequest({ kind, resolve });
    });
  }

  function answer(value?: string) {
    request?.resolve(value);
    setRequest(undefined);
    setPassphrase("");
  }

  return { request, passphrase, setPassphrase, ask, answer };
}
