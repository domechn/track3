const EMPTY_DOWNLOADS = Object.freeze({
  macos: { arm64: [], x64: [] },
  windows: { x64: [] },
  linux: { x64: [] },
  other: [],
});

const PLATFORM_LABELS = {
  macos: {
    arm64: "macOS (Apple Silicon)",
    x64: "macOS (Intel)",
    unknown: "macOS",
  },
  windows: {
    x64: "Windows",
    unknown: "Windows",
  },
  linux: {
    x64: "Linux",
    unknown: "Linux",
  },
  unknown: {
    unknown: "Your device",
  },
};

const INSTALLER_ORDER = {
  macos: ["dmg", "app-tar-gz"],
  windows: ["exe", "msi"],
  linux: ["appimage", "deb", "rpm"],
};

function createEmptyDownloads() {
  return {
    macos: { arm64: [], x64: [] },
    windows: { x64: [] },
    linux: { x64: [] },
    other: [],
  };
}

function classifyAsset(asset) {
  if (!asset || !asset.name || !asset.browser_download_url) {
    return null;
  }

  const name = asset.name;
  if (/\.sig$/i.test(name) || name === "latest.json") {
    return null;
  }

  if (/aarch64\.dmg$/i.test(name)) {
    return { os: "macos", arch: "arm64", kind: "dmg" };
  }
  if (/x64\.dmg$/i.test(name)) {
    return { os: "macos", arch: "x64", kind: "dmg" };
  }
  if (
    /aarch64\.app\.tar\.gz$/i.test(name) ||
    /_aarch64\.app\.tar\.gz$/i.test(name)
  ) {
    return { os: "macos", arch: "arm64", kind: "app-tar-gz" };
  }
  if (/x64\.app\.tar\.gz$/i.test(name) || /_x64\.app\.tar\.gz$/i.test(name)) {
    return { os: "macos", arch: "x64", kind: "app-tar-gz" };
  }
  if (/x64-setup\.exe$/i.test(name)) {
    return { os: "windows", arch: "x64", kind: "exe" };
  }
  if (/x64_en-US\.msi$/i.test(name)) {
    return { os: "windows", arch: "x64", kind: "msi" };
  }
  if (/amd64\.AppImage$/i.test(name)) {
    return { os: "linux", arch: "x64", kind: "appimage" };
  }
  if (/amd64\.deb$/i.test(name)) {
    return { os: "linux", arch: "x64", kind: "deb" };
  }
  if (/x86_64\.rpm$/i.test(name)) {
    return { os: "linux", arch: "x64", kind: "rpm" };
  }

  return null;
}

function compareAssets(os, left, right) {
  const order = INSTALLER_ORDER[os] ?? [];
  const leftIndex = order.indexOf(left.kind);
  const rightIndex = order.indexOf(right.kind);

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  return left.name.localeCompare(right.name);
}

function detectOs(navigatorLike) {
  const platformHint = String(
    navigatorLike?.userAgentData?.platform ?? navigatorLike?.platform ?? "",
  ).toLowerCase();
  const userAgent = String(navigatorLike?.userAgent ?? "").toLowerCase();

  if (platformHint.includes("mac") || /mac os x|macintosh/.test(userAgent)) {
    return "macos";
  }
  if (platformHint.includes("win") || /windows/.test(userAgent)) {
    return "windows";
  }
  if (platformHint.includes("linux") || /linux|x11/.test(userAgent)) {
    return "linux";
  }

  return "unknown";
}

function detectArch(navigatorLike) {
  const architectureHint = String(
    navigatorLike?.userAgentData?.architecture ?? "",
  ).toLowerCase();
  const userAgent = String(navigatorLike?.userAgent ?? "").toLowerCase();

  if (architectureHint.includes("arm")) {
    return { arch: "arm64", confidence: "high" };
  }
  if (
    architectureHint.includes("x86") ||
    architectureHint.includes("x64") ||
    architectureHint.includes("amd64")
  ) {
    return { arch: "x64", confidence: "high" };
  }

  if (/arm64|aarch64|apple silicon/.test(userAgent)) {
    return { arch: "arm64", confidence: "medium" };
  }
  if (/x86_64|win64|wow64|x64|amd64/.test(userAgent)) {
    return { arch: "x64", confidence: "medium" };
  }

  return { arch: "unknown", confidence: "low" };
}

export function detectPlatform(navigatorLike = globalThis.navigator ?? {}) {
  const os = detectOs(navigatorLike);
  const archResult = detectArch(navigatorLike);

  return {
    os,
    arch: archResult.arch,
    confidence: os === "unknown" ? "low" : archResult.confidence,
    label:
      PLATFORM_LABELS[os]?.[archResult.arch] ??
      PLATFORM_LABELS[os]?.unknown ??
      PLATFORM_LABELS.unknown.unknown,
  };
}

export function buildPlatformDownloads(assets = []) {
  const downloads = createEmptyDownloads();

  for (const asset of assets) {
    const match = classifyAsset(asset);
    if (!match) {
      continue;
    }

    const normalized = {
      name: asset.name,
      url: asset.browser_download_url,
      kind: match.kind,
      os: match.os,
      arch: match.arch,
      size: asset.size ?? null,
      downloadCount: asset.download_count ?? null,
    };

    downloads[match.os][match.arch].push(normalized);
  }

  downloads.macos.arm64.sort((left, right) =>
    compareAssets("macos", left, right),
  );
  downloads.macos.x64.sort((left, right) =>
    compareAssets("macos", left, right),
  );
  downloads.windows.x64.sort((left, right) =>
    compareAssets("windows", left, right),
  );
  downloads.linux.x64.sort((left, right) =>
    compareAssets("linux", left, right),
  );

  return downloads;
}

export function pickRecommendedAsset(downloads = EMPTY_DOWNLOADS, platform) {
  if (!platform || !platform.os) {
    return null;
  }

  if (platform.os === "macos") {
    if (platform.arch === "arm64") {
      return downloads.macos.arm64[0] ?? null;
    }
    if (platform.arch === "x64") {
      return downloads.macos.x64[0] ?? null;
    }
    return null;
  }

  if (platform.os === "windows") {
    return downloads.windows.x64[0] ?? null;
  }

  if (platform.os === "linux") {
    return downloads.linux.x64[0] ?? null;
  }

  return null;
}

export function pickAssetForTarget(downloads = EMPTY_DOWNLOADS, target) {
  if (!target?.os || !target?.arch) {
    return null;
  }

  const assets = downloads[target.os]?.[target.arch] ?? [];
  if (!assets.length) {
    return null;
  }

  if (!target.kind) {
    return assets[0] ?? null;
  }

  return assets.find((asset) => asset.kind === target.kind) ?? null;
}

export function resolveLatestDownloadUrl(latestMetadata, target) {
  const version = latestMetadata?.version;
  if (!version || !target?.os || !target?.arch || !target?.kind) {
    return null;
  }

  const tag = `app-v${version}`;
  let fileName = null;

  if (target.os === "macos" && target.arch === "arm64") {
    if (target.kind === "dmg") {
      fileName = `track3_${version}_aarch64.dmg`;
    }
    if (target.kind === "app-tar-gz") {
      fileName = "track3_aarch64.app.tar.gz";
    }
  }

  if (target.os === "macos" && target.arch === "x64") {
    if (target.kind === "dmg") {
      fileName = `track3_${version}_x64.dmg`;
    }
    if (target.kind === "app-tar-gz") {
      fileName = "track3_x64.app.tar.gz";
    }
  }

  if (target.os === "windows" && target.arch === "x64") {
    if (target.kind === "exe") {
      fileName = `track3_${version}_x64-setup.exe`;
    }
    if (target.kind === "msi") {
      fileName = `track3_${version}_x64_en-US.msi`;
    }
  }

  if (target.os === "linux" && target.arch === "x64") {
    if (target.kind === "appimage") {
      fileName = `track3_${version}_amd64.AppImage`;
    }
    if (target.kind === "deb") {
      fileName = `track3_${version}_amd64.deb`;
    }
    if (target.kind === "rpm") {
      fileName = `track3-${version}-1.x86_64.rpm`;
    }
  }

  return fileName
    ? `https://github.com/domechn/track3/releases/download/${tag}/${fileName}`
    : null;
}
