#if canImport(UIKit)
import AVFoundation
import UIKit

@objc(SYPlaybackRuntimeBridgeDelegate)
public protocol PlaybackRuntimeBridgeDelegate: AnyObject {
    func playbackRuntimeRequestPlay(_ runtime: PlaybackRuntimeBridge)
    func playbackRuntime(_ runtime: PlaybackRuntimeBridge, requestPauseManually manual: Bool)
    func playbackRuntime(_ runtime: PlaybackRuntimeBridge, requestSeekTo seconds: Double, sessionIdentifier: UInt64)
    func playbackRuntimeRequestPrefetchEpisode(_ runtime: PlaybackRuntimeBridge, episodeIdentifier: String)
    func playbackRuntime(_ runtime: PlaybackRuntimeBridge, loadingChanged visible: Bool)
}

/// Connects the stability kit to the app's existing AVPlayer and Cicada players.
/// The proxy engines never create a second decoder; they forward commands while
/// the app remains responsible for its existing transport, headers, and renderers.
@objc(SYPlaybackRuntimeBridge)
public final class PlaybackRuntimeBridge: NSObject, PlaybackCoordinatorObserver {
    @objc public weak var delegate: PlaybackRuntimeBridgeDelegate?
    @objc public weak var containerView: DetailPlayerContainerView?

    @objc public var isShowingLoading: Bool { coordinator.isShowingLoading }
    @objc public var activeSessionIdentifier: UInt64 { coordinator.currentSessionId }
    @objc public var hasActiveSession: Bool { !activeContext.isEmpty }

    private let avPlayerEngine = PlaybackRuntimeProxyEngine(kernelType: .avPlayer)
    private let cicadaPlayerEngine = PlaybackRuntimeProxyEngine(kernelType: .cicadaPlayer)
    fileprivate lazy var coordinator: PlaybackSessionCoordinator = {
        let value = PlaybackSessionCoordinator(engines: [
            .avPlayer: avPlayerEngine,
            .cicadaPlayer: cicadaPlayerEngine
        ])
        value.externallyManagedRecovery = true
        value.observer = self
        value.onPreloadNextEpisode = { [weak self] episodeIdentifier in
            guard let self else { return }
            self.delegate?.playbackRuntimeRequestPrefetchEpisode(self, episodeIdentifier: episodeIdentifier)
        }
        return value
    }()
    private var hardwareGuard: IOSHardwareSessionGuard!
    private var activeContext = ""
    private var activeEpisodeIdentifier = ""
    private var activeTitle = ""
    private var activeURL: URL?
    private var activeKernel: PlayerKernelType = .avPlayer

    public override init() {
        super.init()
        avPlayerEngine.runtime = self
        cicadaPlayerEngine.runtime = self
        _ = coordinator
        hardwareGuard = IOSHardwareSessionGuard(coordinator: coordinator)
    }

    @objc(startSessionWithContext:episodeIdentifier:title:mediaURL:startPosition:kernelName:wantsToPlay:)
    public func startSession(
        context: String,
        episodeIdentifier: String,
        title: String,
        mediaURL: NSURL,
        startPosition: Double,
        kernelName: String,
        wantsToPlay: Bool
    ) {
        let url = mediaURL as URL
        activeContext = context
        activeEpisodeIdentifier = episodeIdentifier.isEmpty ? context : episodeIdentifier
        activeTitle = title
        activeURL = url
        activeKernel = Self.kernel(named: kernelName)
        loadCurrentSession(startPosition: startPosition, wantsToPlay: wantsToPlay)
    }

    @objc(switchKernelTo:position:wantsToPlay:)
    public func switchKernel(to kernelName: String, position: Double, wantsToPlay: Bool) {
        guard activeURL != nil, !activeContext.isEmpty else { return }
        activeKernel = Self.kernel(named: kernelName)
        loadCurrentSession(startPosition: position, wantsToPlay: wantsToPlay)
    }

    @objc(receivePlaybackEventForContext:status:currentTime:duration:playing:wantsToPlay:errorMessage:)
    public func receivePlaybackEvent(
        context: String,
        status: String,
        currentTime: Double,
        duration: Double,
        playing: Bool,
        wantsToPlay: Bool,
        errorMessage: String
    ) {
        guard context == activeContext, !activeContext.isEmpty else { return }
        let engine = activeEngine
        switch status {
        case "prepared":
            engine?.report(state: wantsToPlay ? .preparing : .paused)
        case "buffering":
            engine?.report(state: wantsToPlay ? .buffering : .paused)
        case "playing":
            engine?.report(state: .playing)
        case "paused":
            engine?.report(state: .paused)
        case "ready", "firstFrame", "videoReady":
            engine?.reportFirstFrame()
            engine?.report(state: playing ? .playing : .paused)
        case "progress":
            engine?.reportProgress(currentTime: currentTime, duration: duration)
        case "seekFailed":
            coordinator.cancelSeek()
        case "ended":
            engine?.report(state: .ended)
        case "failed", "audioOnly", "rendererFailed":
            engine?.report(state: .error(code: -1, message: errorMessage))
        default:
            break
        }

    }

    @objc(seekToTime:)
    public func seek(to seconds: Double) {
        guard seconds.isFinite, seconds >= 0, hasActiveSession else { return }
        coordinator.beginSeek(targetTime: seconds)
        coordinator.commitSeek(to: seconds)
    }

    @objc(nativeSeekCompletedAtPosition:sessionIdentifier:)
    public func nativeSeekCompleted(at position: Double, sessionIdentifier: UInt64) {
        guard sessionIdentifier == coordinator.currentSessionId else { return }
        activeEngine?.reportSeekCompleted(position: position)
    }

    @objc(pauseManually)
    public func pauseManually() {
        guard hasActiveSession else { return }
        coordinator.pause(manual: true)
    }

    @objc(stopSession)
    public func stopSession() {
        guard hasActiveSession else { return }
        coordinator.teardown()
        activeContext = ""
        activeEpisodeIdentifier = ""
        activeTitle = ""
        activeURL = nil
        activeKernel = .avPlayer
    }

    @objc(preloadEpisodeWithIdentifier:mediaURL:headers:)
    public func preloadEpisode(identifier: String, mediaURL: NSURL, headers: NSDictionary) {
        guard !identifier.isEmpty else { return }
        let url = mediaURL as URL
        hardwareGuard.preloadNextEpisode(episodeId: identifier, streamURL: url, headers: headers as? [String: String] ?? [:])
    }

    @objc(purgePreloadedAssets)
    public func purgePreloadedAssets() {
        hardwareGuard.purgePreloadCacheOnMemoryWarning()
    }

    private var activeEngine: PlaybackRuntimeProxyEngine? {
        activeKernel == .cicadaPlayer ? cicadaPlayerEngine : avPlayerEngine
    }

    private func loadCurrentSession(startPosition: Double, wantsToPlay: Bool) {
        guard let url = activeURL else { return }
        let line = StreamLine(
            lineId: "\(activeContext):\(activeKernel.rawValue)",
            label: activeKernel.rawValue,
            url: url,
            kernel: activeKernel
        )
        let request = EpisodePlayRequest(
            episodeId: activeEpisodeIdentifier,
            title: activeTitle,
            lines: [line],
            initialPosition: max(0, startPosition.isFinite ? startPosition : 0)
        )
        coordinator.load(request: request)
        if wantsToPlay {
            coordinator.play()
        } else {
            coordinator.pause(manual: true)
        }
    }

    private static func kernel(named name: String) -> PlayerKernelType {
        name == PlayerKernelType.cicadaPlayer.rawValue ? .cicadaPlayer : .avPlayer
    }

    // MARK: PlaybackCoordinatorObserver

    public func coordinatorDidUpdateState(_ state: PlaybackState, episodeId: String, line: StreamLine?) {}

    public func coordinatorDidUpdateProgress(currentTime: TimeInterval, duration: TimeInterval) {}

    public func coordinatorShouldShowLoading(_ show: Bool) {
        delegate?.playbackRuntime(self, loadingChanged: show)
    }

    public func coordinatorShouldShowPoster(_ show: Bool) {
        containerView?.setPosterVisible(show, animated: true)
    }
}

private final class PlaybackRuntimeProxyEngine: NSObject, PlayerEngineProtocol {
    let kernelType: PlayerKernelType
    private(set) var activeSessionId: UInt64 = 0
    weak var delegate: PlayerEngineDelegate?
    weak var runtime: PlaybackRuntimeBridge?
    let renderView = UIView()

    init(kernelType: PlayerKernelType) {
        self.kernelType = kernelType
        super.init()
    }

    func prepare(url: URL, startPosition: TimeInterval, sessionId: UInt64) {
        activeSessionId = sessionId
        delegate?.engine(self, didChangeState: .preparing, sessionId: sessionId)
    }

    func play() {
        guard let runtime else { return }
        runtime.delegate?.playbackRuntimeRequestPlay(runtime)
    }

    func pause() {
        guard let runtime else { return }
        runtime.delegate?.playbackRuntime(runtime, requestPauseManually: runtime.coordinator.userManuallyPaused)
    }

    func seek(to seconds: TimeInterval, sessionId: UInt64) {
        guard sessionId == activeSessionId, let runtime else { return }
        runtime.delegate?.playbackRuntime(runtime, requestSeekTo: seconds, sessionIdentifier: sessionId)
    }

    func stopAndRelease() {
        activeSessionId = 0
    }

    func report(state: PlaybackState) {
        guard activeSessionId != 0 else { return }
        delegate?.engine(self, didChangeState: state, sessionId: activeSessionId)
    }

    func reportProgress(currentTime: Double, duration: Double) {
        guard activeSessionId != 0 else { return }
        delegate?.engine(self, didUpdateProgress: currentTime, duration: duration, sessionId: activeSessionId)
    }

    func reportFirstFrame() {
        guard activeSessionId != 0 else { return }
        delegate?.engineDidRenderFirstFrame(self, sessionId: activeSessionId)
    }

    func reportSeekCompleted(position: Double) {
        guard activeSessionId != 0 else { return }
        delegate?.engineDidCompleteSeek(self, position: position, sessionId: activeSessionId)
    }
}

#endif
