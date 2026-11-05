export type DisplaySource = { id?: string; alias?: string; type?: string; wallet?: string };

function value(input?: string) {
  const trimmed = input?.trim();
  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : undefined;
}

const chainAddress = /^(?:0x[a-f\d]{24,}|bc1[a-z\d]{20,})$/i;
const longAddress = /^[A-Za-z0-9_-]{25,}$/;
const opaque = /^[a-f\d]{32,}$/i;
const chain = /^(?:BTC|DOGE|ERC20|SOL|TRC20|TON|SUI)$/i;
const short = (input: string) => `${input.slice(0, 6)}…${input.slice(-4)}`;

function sourceName(source: DisplaySource): string | undefined {
  const alias = value(source.alias);
  const address = value(source.wallet);
  const type = value(source.type);
  const id = value(source.id);
  if (alias && (chainAddress.test(alias) || alias === address && longAddress.test(alias))) return short(alias);
  if (alias && !opaque.test(alias)) return alias;
  if (type && !chain.test(type) && !opaque.test(type)) return type;
  if (address && (chainAddress.test(address) || longAddress.test(address) && !opaque.test(address))) return short(address);
  if (address && !opaque.test(address)) return address;
  if (id && (chainAddress.test(id) || longAddress.test(id) && !opaque.test(id))) return short(id);
  if (id && !opaque.test(id)) return id;
}

export function needsWalletName(source: DisplaySource): boolean {
  return sourceName(source) === undefined && !!(value(source.id) || value(source.wallet) || value(source.alias) || value(source.type));
}

export function sourceDisplayNames(
  sources: readonly DisplaySource[],
  walletName = (index: number) => `Wallet ${index}`,
  walletOrdinals?: Readonly<Record<string, number>>,
): string[] {
  let wallets = 0;
  const currentWallets = Object.keys(walletOrdinals ?? {}).length;
  const names = sources.map((source, index) => {
    const id = value(source.id);
    return sourceName(source) ?? (needsWalletName(source)
      ? walletName((id ? walletOrdinals?.[id] : undefined) ?? currentWallets + ++wallets)
      : `Source ${index + 1}`);
  });
  return names.map((name, index) => names.indexOf(name) === names.lastIndexOf(name)
    ? name : `${name} (${names.slice(0, index + 1).filter((item) => item === name).length})`);
}

export function transactionSourceName(id: string, source?: DisplaySource) {
  if (!source) return undefined;
  const name = sourceDisplayNames([{ id, ...source }])[0];
  return source.alias && source.alias !== source.wallet && source.alias !== "null" && source.type
    ? `${name} (${source.type})` : name;
}
