import Foundation
import Darwin
import LocalAuthentication
import Security
import UIKit
import UserNotifications

private final class Track3PrivacyLock: NSObject {
    static let shared = Track3PrivacyLock()
    private let setting = "track3.ios.appLockEnabled"
    private let overlayTag = 0x74A3
    private var installed = false
    private var authenticating = false
    private var needsUnlock = false
    private var unlockGeneration = 0

    var enabled: Bool { UserDefaults.standard.bool(forKey: setting) }

    func install() {
        guard !installed else { return }
        installed = true
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(privacyCover), name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(background), name: UIApplication.didEnterBackgroundNotification, object: nil)
        center.addObserver(self, selector: #selector(foreground), name: UIApplication.didBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(windowVisible), name: UIWindow.didBecomeVisibleNotification, object: nil)
        if enabled {
            needsUnlock = true
            cover()
            if !windows.isEmpty && UIApplication.shared.applicationState == .active { authenticateForeground() }
        }
    }

    func setEnabled(_ value: Bool) {
        UserDefaults.standard.set(value, forKey: setting)
        if !value { DispatchQueue.main.async {
            self.needsUnlock = false
            if UIApplication.shared.applicationState == .active { self.uncover() }
        } }
    }

    private var windows: [UIWindow] {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .filter { !$0.isHidden }
    }

    private func cover() {
        for window in windows where window.viewWithTag(overlayTag) == nil {
            let cover = UIView(frame: window.bounds)
            cover.tag = overlayTag
            cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            cover.backgroundColor = .systemBackground
            let stack = UIStackView()
            stack.axis = .vertical
            stack.alignment = .center
            stack.spacing = 18
            stack.translatesAutoresizingMaskIntoConstraints = false
            let title = UILabel()
            let chinese = Locale.preferredLanguages.first?.hasPrefix("zh") == true
            title.text = chinese ? "Track3 已锁定" : "Track3 is locked"
            title.font = .preferredFont(forTextStyle: .title2)
            let button = UIButton(type: .system)
            button.setTitle(chinese ? "解锁" : "Unlock", for: .normal)
            button.addTarget(self, action: #selector(retry), for: .touchUpInside)
            button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 24, bottom: 12, right: 24)
            stack.addArrangedSubview(title)
            stack.addArrangedSubview(button)
            cover.addSubview(stack)
            NSLayoutConstraint.activate([
                stack.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
                stack.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
            ])
            window.addSubview(cover)
        }
    }

    private func uncover() {
        for window in windows { window.viewWithTag(overlayTag)?.removeFromSuperview() }
    }

    @objc private func privacyCover() { cover() }

    @objc private func background() {
        if enabled { unlockGeneration &+= 1; needsUnlock = true; cover() }
    }

    @objc private func foreground() {
        if enabled && needsUnlock { cover(); authenticateForeground() }
        else { uncover() }
    }

    @objc private func windowVisible() {
        if enabled && needsUnlock {
            cover()
            if UIApplication.shared.applicationState == .active { authenticateForeground() }
        } else if UIApplication.shared.applicationState != .active {
            cover()
        }
    }

    @objc private func retry() { authenticateForeground() }

    private func authenticateForeground() {
        guard enabled && !authenticating && !windows.isEmpty else { return }
        authenticating = true
        let generation = unlockGeneration
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            authenticating = false
            setEnabled(false)
            showUnavailableAlert()
            return
        }
        let chinese = Locale.preferredLanguages.first?.hasPrefix("zh") == true
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: chinese ? "解锁 Track3" : "Unlock Track3") { success, _ in
            DispatchQueue.main.async {
                self.authenticating = false
                if success && self.enabled && generation == self.unlockGeneration {
                    self.needsUnlock = false
                    self.uncover()
                } else if self.enabled && generation != self.unlockGeneration && UIApplication.shared.applicationState == .active {
                    self.authenticateForeground()
                }
            }
        }
    }

    private func showUnavailableAlert() {
        let chinese = Locale.preferredLanguages.first?.hasPrefix("zh") == true
        let alert = UIAlertController(
            title: chinese ? "设备锁定不可用" : "Device lock unavailable",
            message: chinese ? "请在 iOS 设置中启用设备密码，然后重新开启 Track3 锁定。" : "Set a device passcode in iOS Settings, then turn Track3 lock on again.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: chinese ? "好" : "OK", style: .default))
        DispatchQueue.main.async {
            guard let root = self.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return }
            root.present(alert, animated: true)
        }
    }
}

private enum Track3Keychain {
    static let service = "dev.track3.ios.encryption"
    static let account = "master-key"

    #if targetEnvironment(simulator)
    static var simulatorKeyURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(".track3-simulator-key")
    }

    static func readSimulatorKey() -> Data? {
        try? Data(contentsOf: simulatorKeyURL)
    }

    static func writeSimulatorKey(_ data: Data) -> Bool {
        let url = simulatorKeyURL
        var staged = url.deletingLastPathComponent().appendingPathComponent(UUID().uuidString)
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: staged, options: .atomic)
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: staged.path
            )
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try staged.setResourceValues(values)
            let status = staged.path.withCString { old in
                url.path.withCString { new in rename(old, new) }
            }
            guard status == 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno)) }
            return true
        } catch {
            try? FileManager.default.removeItem(at: staged)
            return false
        }
    }
    #endif

    static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }
}

@_cdecl("track3_ios_keychain_read")
public func track3IOSKeychainRead(_ output: UnsafeMutablePointer<UInt8>?, _ capacity: Int32) -> Int32 {
    guard let output, capacity > 0 else { return -2 }
    #if targetEnvironment(simulator)
    if FileManager.default.fileExists(atPath: Track3Keychain.simulatorKeyURL.path) {
        guard let data = Track3Keychain.readSimulatorKey() else { return Int32(errSecInteractionNotAllowed) }
        guard data.count <= Int(capacity) else { return -2 }
        for (index, byte) in data.enumerated() { output[index] = byte }
        return Int32(data.count)
    }
    #endif
    var query = Track3Keychain.query
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    #if targetEnvironment(simulator)
    if status == errSecMissingEntitlement { return -1 }
    #endif
    if status == errSecItemNotFound { return -1 }
    guard status == errSecSuccess else { return Int32(status) }
    guard let data = result as? Data, data.count <= Int(capacity) else { return -2 }
    for (index, byte) in data.enumerated() { output[index] = byte }
    return Int32(data.count)
}

@_cdecl("track3_ios_keychain_write")
public func track3IOSKeychainWrite(_ input: UnsafePointer<UInt8>?, _ length: Int32) -> Int32 {
    guard let input, length > 0 else { return -2 }
    let data = Data(bytes: input, count: Int(length))
    #if targetEnvironment(simulator)
    if FileManager.default.fileExists(atPath: Track3Keychain.simulatorKeyURL.path) {
        return Track3Keychain.writeSimulatorKey(data) ? 0 : Int32(errSecMissingEntitlement)
    }
    #endif
    let status = SecItemUpdate(Track3Keychain.query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if status == errSecSuccess { return Int32(errSecSuccess) }
    #if targetEnvironment(simulator)
    if status == errSecMissingEntitlement {
        return Track3Keychain.writeSimulatorKey(data) ? 0 : Int32(status)
    }
    #endif
    guard status == errSecItemNotFound else { return Int32(status) }
    var query = Track3Keychain.query
    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let addStatus = SecItemAdd(query as CFDictionary, nil)
    #if targetEnvironment(simulator)
    if addStatus == errSecMissingEntitlement {
        return Track3Keychain.writeSimulatorKey(data) ? 0 : Int32(addStatus)
    }
    #endif
    return Int32(addStatus)
}

@_cdecl("track3_ios_keychain_delete")
public func track3IOSKeychainDelete() -> Bool {
    #if targetEnvironment(simulator)
    if FileManager.default.fileExists(atPath: Track3Keychain.simulatorKeyURL.path) {
        do {
            try FileManager.default.removeItem(at: Track3Keychain.simulatorKeyURL)
            return true
        } catch { return false }
    }
    #endif
    let status = SecItemDelete(Track3Keychain.query as CFDictionary)
    return status == errSecSuccess || status == errSecItemNotFound
}

@_cdecl("track3_ios_install_native")
public func track3IOSInstallNative() {
    DispatchQueue.main.async { Track3PrivacyLock.shared.install() }
}

@_cdecl("track3_ios_lock_enabled")
public func track3IOSLockEnabled() -> Bool {
    Track3PrivacyLock.shared.enabled
}

@_cdecl("track3_ios_set_lock_enabled")
public func track3IOSSetLockEnabled(_ enabled: Bool) {
    Track3PrivacyLock.shared.setEnabled(enabled)
}

@_cdecl("track3_ios_authenticate")
public func track3IOSAuthenticate() -> Bool {
    let context = LAContext()
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { return false }
    let semaphore = DispatchSemaphore(value: 0)
    var approved = false
    let chinese = Locale.preferredLanguages.first?.hasPrefix("zh") == true
    context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: chinese ? "更改 Track3 锁定设置" : "Change Track3 lock settings") { success, _ in
        approved = success
        semaphore.signal()
    }
    guard semaphore.wait(timeout: .now() + 90) == .success else {
        context.invalidate()
        return false
    }
    return approved
}

@_cdecl("track3_ios_haptic")
public func track3IOSHaptic(_ kind: UInt8) {
    DispatchQueue.main.async {
        switch kind {
        case 1: UINotificationFeedbackGenerator().notificationOccurred(.success)
        case 2: UINotificationFeedbackGenerator().notificationOccurred(.error)
        default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }
}

@_cdecl("track3_ios_set_badge")
public func track3IOSSetBadge(_ count: Int32) {
    DispatchQueue.main.async {
        let badge = Int(max(0, count))
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(badge) { error in
                if let error { NSLog("Track3 badge update failed: %@", error.localizedDescription) }
            }
        } else {
            UIApplication.shared.applicationIconBadgeNumber = badge
        }
    }
}

@_cdecl("track3_ios_share_file")
public func track3IOSShareFile(_ path: UnsafePointer<CChar>) -> Bool {
    let source = URL(fileURLWithPath: String(cString: path))
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    let staged = folder.appendingPathComponent(source.lastPathComponent)
    do {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        try FileManager.default.copyItem(at: source, to: staged)
    }
    catch {
        try? FileManager.default.removeItem(at: folder)
        return false
    }
    DispatchQueue.main.async {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }),
              let root = window.rootViewController else {
            try? FileManager.default.removeItem(at: folder)
            return
        }
        let controller = UIActivityViewController(activityItems: [staged], applicationActivities: nil)
        controller.completionWithItemsHandler = { _, _, _, _ in
            try? FileManager.default.removeItem(at: folder)
        }
        if let popover = controller.popoverPresentationController {
            popover.sourceView = root.view
            popover.sourceRect = CGRect(x: root.view.bounds.midX, y: root.view.bounds.maxY, width: 1, height: 1)
        }
        var presenter = root
        while let presented = presenter.presentedViewController { presenter = presented }
        presenter.present(controller, animated: true)
    }
    return true
}
