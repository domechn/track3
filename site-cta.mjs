export function recommendedCta(platform) {
  if (platform.os === "ios")
    return {
      label: "iPhone & iPad install steps",
      href: "./download.html#ios",
    };
  const label = { macos: "macOS", windows: "Windows", linux: "Linux" }[
    platform.os
  ];
  return {
    label: label ? `Download for ${label}` : "Get Track3",
    href: "./download.html",
  };
}
