export function SignedInlineText({ text }: { text: string }) {
  return <>{text.split(/((?<![\p{L}\d])[+−-][^\s\d]*\d[\d,.]*%?)/gu).map((part, index) =>
    index % 2 ? <span className="t3-signed-unit" key={index}>{part}</span> : part)}</>;
}
