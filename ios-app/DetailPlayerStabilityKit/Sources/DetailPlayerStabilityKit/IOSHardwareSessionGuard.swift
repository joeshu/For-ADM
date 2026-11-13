import Foundation
import AVFoundation

#if canImport(UIKit)
import UIKit
#endif

public final class IOSHardwareSessionGuard {
    public weak var coordinator: PlaybackSessionCoordinator?
    public private(set) var wasPlayingBeforeInterruption: Bool = false
    public private(set) var preloadedEpisodeIds: Set<String> = []
    public private(set) var isIdleTimerDisabled: Bool = false

    private var interruptionObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?
    private var memoryWarningObserver: NSObjectProtocol?
    private var preloadAssets: [String: AVURLAsset] = [:]

    public init(coordinator: PlaybackSessionCoordinator) {
        self.coordinator = coordinator
        bindCoordinatorHooks()
        registerNotifications()
    }

    deinit {
        if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
        if let routeChangeObserver { NotificationCenter.default.removeObserver(routeChangeObserver) }
        if let memoryWarningObserver { NotificationCenter.default.removeObserver(memoryWarningObserver) }
    }

    private func bindCoordinatorHooks() {
        coordinator?.onIdleTimerRequirementChanged = { [weak self] keepAwake in
            self?.syncIdleTimer(keepScreenAwake: keepAwake)
        }
    }

    private func registerNotifications() {
        #if os(iOS)
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] note in
            guard let info = note.userInfo,
                  let typeVal = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeVal) else { return }
            let optVal = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: optVal)
            self?.handleAudioInterruption(began: type == .began, shouldResume: options.contains(.shouldResume))
        }

        routeChangeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] note in
            guard let info = note.userInfo,
                  let reasonVal = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
                  let reason = AVAudioSession.RouteChangeReason(rawValue: reasonVal) else { return }
            if reason == .oldDeviceUnavailable {
                self?.handleHeadphonesDisconnected()
            }
        }

        memoryWarningObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.purgePreloadCacheOnMemoryWarning()
        }
        #endif
    }

    public func syncIdleTimer(keepScreenAwake: Bool) {
        isIdleTimerDisabled = keepScreenAwake
        #if os(iOS)
        UIApplication.shared.isIdleTimerDisabled = keepScreenAwake
        #endif
    }

    public func handleAudioInterruption(began: Bool, shouldResume: Bool) {
        guard let coordinator else { return }
        if began {
            wasPlayingBeforeInterruption = coordinator.currentState.isActivelyPlaying
            if wasPlayingBeforeInterruption {
                coordinator.pause(manual: false)
            }
        } else {
            if wasPlayingBeforeInterruption && shouldResume && !coordinator.userManuallyPaused {
                coordinator.play()
            }
            wasPlayingBeforeInterruption = false
        }
    }

    public func handleHeadphonesDisconnected() {
        coordinator?.pause(manual: true)
    }

    public func preloadNextEpisode(episodeId: String, streamURL: URL) {
        guard !preloadedEpisodeIds.contains(episodeId) else { return }
        preloadedEpisodeIds.insert(episodeId)
        let asset = AVURLAsset(url: streamURL)
        asset.loadValuesAsynchronously(forKeys: ["playable"])
        preloadAssets[episodeId] = asset
    }

    public func purgePreloadCacheOnMemoryWarning() {
        preloadAssets.values.forEach { $0.cancelLoading() }
        preloadAssets.removeAll()
        preloadedEpisodeIds.removeAll()
    }
}
