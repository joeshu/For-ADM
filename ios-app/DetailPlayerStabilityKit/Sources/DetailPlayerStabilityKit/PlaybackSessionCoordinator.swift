import Foundation

public protocol PlaybackCoordinatorObserver: AnyObject {
    func coordinatorDidUpdateState(_ state: PlaybackState, episodeId: String, line: StreamLine?)
    func coordinatorDidUpdateProgress(currentTime: TimeInterval, duration: TimeInterval)
    func coordinatorShouldShowLoading(_ show: Bool)
    func coordinatorShouldShowPoster(_ show: Bool)
}

public final class PlaybackSessionCoordinator: PlayerEngineDelegate {
    public private(set) var currentSessionId: UInt64 = 0
    public private(set) var currentState: PlaybackState = .idle
    public private(set) var currentRequest: EpisodePlayRequest?
    public private(set) var currentLineIndex: Int = 0
    public private(set) var currentTime: TimeInterval = 0
    public private(set) var duration: TimeInterval = 0
    public private(set) var isSeeking: Bool = false
    public private(set) var isShowingLoading: Bool = false
    public private(set) var isPosterVisible: Bool = true
    public private(set) var isLockedOnFallbackLine: Bool = false
    public private(set) var userManuallyPaused: Bool = false

    public weak var observer: PlaybackCoordinatorObserver?
    public var onPreloadNextEpisode: ((String) -> Void)?
    public var onRefreshSignedURL: ((EpisodePlayRequest, StreamLine, @escaping (URL?) -> Void) -> Void)?
    public var onIdleTimerRequirementChanged: ((Bool) -> Void)?

    private var engines: [PlayerKernelType: PlayerEngineProtocol]
    private var activeEngine: PlayerEngineProtocol?
    private var bufferingDebounceWorkItem: DispatchWorkItem?
    private var seekGuardWorkItem: DispatchWorkItem?
    private var retryWorkItem: DispatchWorkItem?
    private var retryCountForCurrentLine: Int = 0
    private let maxRetriesPerLine: Int = 2
    private var hasTriggeredPreloadForCurrentEpisode: Bool = false
    private var hasRefreshed403ForCurrentLine: Bool = false

    public var bufferingDebounceInterval: TimeInterval = 0.30
    public var seekGuardTimeout: TimeInterval = 0.80
    // The app may own a separate recovery gate. In that mode this coordinator
    // still serializes state/progress/seek and hardware events, but never starts
    // another retry or line switch on its own.
    public var externallyManagedRecovery = false

    public init(engines: [PlayerKernelType: PlayerEngineProtocol]? = nil) {
        if let engines {
            self.engines = engines
        } else {
            self.engines = [.avPlayer: AVPlayerEngine()]
        }
        self.engines.values.forEach { $0.delegate = self }
    }

    public func registerEngine(_ engine: PlayerEngineProtocol) {
        engine.delegate = self
        engines[engine.kernelType] = engine
    }

    public func load(request: EpisodePlayRequest, preferredLineIndex: Int = 0) {
        cancelPendingTimers()
        currentSessionId &+= 1
        let session = currentSessionId

        currentRequest = request
        currentLineIndex = min(max(0, preferredLineIndex), max(0, request.lines.count - 1))
        currentTime = request.initialPosition
        duration = 0
        isSeeking = false
        isLockedOnFallbackLine = false
        userManuallyPaused = false
        retryCountForCurrentLine = 0
        hasTriggeredPreloadForCurrentEpisode = false
        hasRefreshed403ForCurrentLine = false

        setPosterVisible(true)
        setLoadingVisible(true, immediate: true)

        guard !request.lines.isEmpty else {
            transition(to: .error(code: -1001, message: "No playable stream lines"), sessionId: session)
            return
        }

        startLine(at: currentLineIndex, startPosition: request.initialPosition, sessionId: session)
    }

    public func switchLine(to index: Int) {
        guard let request = currentRequest, index >= 0, index < request.lines.count else { return }
        cancelPendingTimers()
        currentSessionId &+= 1
        let session = currentSessionId
        currentLineIndex = index
        retryCountForCurrentLine = 0
        hasRefreshed403ForCurrentLine = false
        isLockedOnFallbackLine = (index > 0)
        setPosterVisible(true)
        startLine(at: index, startPosition: currentTime, sessionId: session)
    }

    public func play() {
        userManuallyPaused = false
        activeEngine?.play()
    }

    public func pause(manual: Bool = true) {
        if manual {
            userManuallyPaused = true
        }
        activeEngine?.pause()
    }

    public func beginSeek(targetTime: TimeInterval) {
        isSeeking = true
        currentTime = max(0, targetTime)
        observer?.coordinatorDidUpdateProgress(currentTime: currentTime, duration: duration)

        seekGuardWorkItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            self?.isSeeking = false
        }
        seekGuardWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + seekGuardTimeout, execute: item)
    }

    public func cancelSeek() {
        seekGuardWorkItem?.cancel()
        isSeeking = false
    }

    public func commitSeek(to targetTime: TimeInterval) {
        let clamped = max(0, duration > 0 ? min(targetTime, duration) : targetTime)
        currentTime = clamped
        observer?.coordinatorDidUpdateProgress(currentTime: clamped, duration: duration)
        activeEngine?.seek(to: clamped, sessionId: currentSessionId)
    }

    public func teardown() {
        cancelPendingTimers()
        currentSessionId &+= 1
        activeEngine?.stopAndRelease()
        activeEngine = nil
        currentState = .idle
        isSeeking = false
        setLoadingVisible(false, immediate: true)
        setPosterVisible(true)
        observer?.coordinatorDidUpdateState(.idle, episodeId: currentRequest?.episodeId ?? "", line: nil)
        onIdleTimerRequirementChanged?(false)
    }

    private func startLine(at index: Int, startPosition: TimeInterval, sessionId: UInt64) {
        guard sessionId == currentSessionId, let request = currentRequest, index < request.lines.count else { return }
        let line = request.lines[index]
        guard let targetEngine = engines[line.kernel] else {
            transition(to: .error(code: -1002, message: "Engine not registered for \(line.kernel.rawValue)"), sessionId: sessionId)
            return
        }

        if let existing = activeEngine, existing !== targetEngine {
            existing.stopAndRelease()
        }
        activeEngine = targetEngine
        targetEngine.prepare(url: line.url, startPosition: startPosition, sessionId: sessionId)
    }

    private func transition(to newState: PlaybackState, sessionId: UInt64) {
        guard sessionId == currentSessionId else { return }
        currentState = newState
        onIdleTimerRequirementChanged?(newState.isActivelyPlaying)

        switch newState {
        case .playing:
            setLoadingVisible(false, immediate: true)
            setPosterVisible(false)
            retryCountForCurrentLine = 0
        case .buffering:
            scheduleDebouncedLoading()
        case .preparing:
            setLoadingVisible(true, immediate: true)
        case .paused, .ended:
            setLoadingVisible(false, immediate: true)
        case .error(let code, let message):
            if externallyManagedRecovery {
                setLoadingVisible(false, immediate: true)
                let activeLine = currentRequest?.lines[safe: currentLineIndex]
                observer?.coordinatorDidUpdateState(newState, episodeId: currentRequest?.episodeId ?? "", line: activeLine)
                return
            }
            handlePlaybackError(code: code, message: message, sessionId: sessionId)
            return
        case .idle:
            setLoadingVisible(false, immediate: true)
        }

        let activeLine = currentRequest?.lines[safe: currentLineIndex]
        observer?.coordinatorDidUpdateState(newState, episodeId: currentRequest?.episodeId ?? "", line: activeLine)
    }

    private func handlePlaybackError(code: Int, message: String, sessionId: UInt64) {
        guard sessionId == currentSessionId, let request = currentRequest else { return }
        let activeLine = request.lines[safe: currentLineIndex]

        if code == 403, !hasRefreshed403ForCurrentLine, let line = activeLine, let refresher = onRefreshSignedURL {
            hasRefreshed403ForCurrentLine = true
            refresher(request, line) { [weak self] refreshedURL in
                guard let self, self.currentSessionId == sessionId else { return }
                if let refreshedURL {
                    let updatedLine = StreamLine(lineId: line.lineId, label: line.label, url: refreshedURL, kernel: line.kernel)
                    var updatedLines = request.lines
                    updatedLines[self.currentLineIndex] = updatedLine
                    self.currentRequest = EpisodePlayRequest(
                        episodeId: request.episodeId,
                        title: request.title,
                        lines: updatedLines,
                        initialPosition: self.currentTime
                    )
                    self.startLine(at: self.currentLineIndex, startPosition: self.currentTime, sessionId: sessionId)
                } else {
                    self.escalateErrorOrFallback(code: code, message: message, sessionId: sessionId)
                }
            }
            return
        }

        escalateErrorOrFallback(code: code, message: message, sessionId: sessionId)
    }

    private func escalateErrorOrFallback(code: Int, message: String, sessionId: UInt64) {
        guard sessionId == currentSessionId, let request = currentRequest else { return }

        if retryCountForCurrentLine < maxRetriesPerLine {
            retryCountForCurrentLine += 1
            let delay = pow(2.0, Double(retryCountForCurrentLine - 1))
            retryWorkItem?.cancel()
            let work = DispatchWorkItem { [weak self] in
                guard let self, self.currentSessionId == sessionId else { return }
                self.startLine(at: self.currentLineIndex, startPosition: self.currentTime, sessionId: sessionId)
            }
            retryWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
            return
        }

        let nextIndex = currentLineIndex + 1
        if !isLockedOnFallbackLine, nextIndex < request.lines.count {
            currentLineIndex = nextIndex
            retryCountForCurrentLine = 0
            hasRefreshed403ForCurrentLine = false
            isLockedOnFallbackLine = true
            startLine(at: nextIndex, startPosition: currentTime, sessionId: sessionId)
            return
        }

        setLoadingVisible(false, immediate: true)
        let activeLine = request.lines[safe: currentLineIndex]
        observer?.coordinatorDidUpdateState(.error(code: code, message: message), episodeId: request.episodeId, line: activeLine)
    }

    private func scheduleDebouncedLoading() {
        bufferingDebounceWorkItem?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self, case .buffering = self.currentState else { return }
            self.setLoadingVisible(true, immediate: true)
        }
        bufferingDebounceWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + bufferingDebounceInterval, execute: item)
    }

    private func setLoadingVisible(_ visible: Bool, immediate: Bool) {
        if immediate {
            bufferingDebounceWorkItem?.cancel()
        }
        guard isShowingLoading != visible else { return }
        isShowingLoading = visible
        observer?.coordinatorShouldShowLoading(visible)
    }

    private func setPosterVisible(_ visible: Bool) {
        guard isPosterVisible != visible else { return }
        isPosterVisible = visible
        observer?.coordinatorShouldShowPoster(visible)
    }

    private func cancelPendingTimers() {
        bufferingDebounceWorkItem?.cancel()
        seekGuardWorkItem?.cancel()
        retryWorkItem?.cancel()
    }

    // MARK: - PlayerEngineDelegate

    public func engine(_ engine: PlayerEngineProtocol, didChangeState state: PlaybackState, sessionId: UInt64) {
        guard sessionId == currentSessionId else { return }
        transition(to: state, sessionId: sessionId)
    }

    public func engine(_ engine: PlayerEngineProtocol, didUpdateProgress currentTime: TimeInterval, duration: TimeInterval, sessionId: UInt64) {
        guard sessionId == currentSessionId else { return }
        guard !isSeeking else { return }

        self.currentTime = currentTime
        self.duration = duration
        observer?.coordinatorDidUpdateProgress(currentTime: currentTime, duration: duration)

        if duration > 0, (currentTime / duration) >= 0.75, !hasTriggeredPreloadForCurrentEpisode, let epId = currentRequest?.episodeId {
            hasTriggeredPreloadForCurrentEpisode = true
            onPreloadNextEpisode?(epId)
        }
    }

    public func engineDidRenderFirstFrame(_ engine: PlayerEngineProtocol, sessionId: UInt64) {
        guard sessionId == currentSessionId else { return }
        setPosterVisible(false)
        setLoadingVisible(false, immediate: true)
    }

    public func engineDidCompleteSeek(_ engine: PlayerEngineProtocol, position: TimeInterval, sessionId: UInt64) {
        guard sessionId == currentSessionId else { return }
        seekGuardWorkItem?.cancel()
        isSeeking = false
        currentTime = position
        observer?.coordinatorDidUpdateProgress(currentTime: position, duration: duration)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
