import XCTest
@testable import DetailPlayerStabilityKit

final class MockPlayerEngine: PlayerEngineProtocol {
    let kernelType: PlayerKernelType
    private(set) var activeSessionId: UInt64 = 0
    weak var delegate: PlayerEngineDelegate?
    let renderView = PlatformRenderView()

    var preparedURLs: [(URL, UInt64)] = []
    var stopCount: Int = 0
    var playCount: Int = 0
    var pauseCount: Int = 0
    var seekTargets: [(TimeInterval, UInt64)] = []

    init(kernel: PlayerKernelType) {
        self.kernelType = kernel
    }

    func prepare(url: URL, startPosition: TimeInterval, sessionId: UInt64) {
        activeSessionId = sessionId
        preparedURLs.append((url, sessionId))
        delegate?.engine(self, didChangeState: .preparing, sessionId: sessionId)
    }

    func play() {
        playCount += 1
        delegate?.engine(self, didChangeState: .playing, sessionId: activeSessionId)
    }

    func pause() {
        pauseCount += 1
        delegate?.engine(self, didChangeState: .paused, sessionId: activeSessionId)
    }

    func seek(to seconds: TimeInterval, sessionId: UInt64) {
        seekTargets.append((seconds, sessionId))
    }

    func stopAndRelease() {
        stopCount += 1
        activeSessionId = 0
    }

    func simulateFirstFrameAndPlay(for sessionId: UInt64) {
        delegate?.engineDidRenderFirstFrame(self, sessionId: sessionId)
        delegate?.engine(self, didChangeState: .playing, sessionId: sessionId)
    }

    func simulateProgress(_ current: TimeInterval, duration: TimeInterval, for sessionId: UInt64) {
        delegate?.engine(self, didUpdateProgress: current, duration: duration, sessionId: sessionId)
    }

    func simulateSeekComplete(_ pos: TimeInterval, for sessionId: UInt64) {
        delegate?.engineDidCompleteSeek(self, position: pos, sessionId: sessionId)
    }

    func simulateError(code: Int, message: String, for sessionId: UInt64) {
        delegate?.engine(self, didChangeState: .error(code: code, message: message), sessionId: sessionId)
    }
}

final class PlaybackCoordinatorTests: XCTestCase {
    private func makeSampleRequest(id: String, lines: Int = 2, kernel: PlayerKernelType = .avPlayer) -> EpisodePlayRequest {
        let streamLines = (0..<lines).map { idx in
            StreamLine(
                lineId: "line_\(idx)",
                label: "Line \(idx)",
                url: URL(string: "https://cdn.example.com/\(id)/line\(idx).m3u8")!,
                kernel: kernel
            )
        }
        return EpisodePlayRequest(episodeId: id, title: "Episode \(id)", lines: streamLines)
    }

    func test01_SessionIdRejectsStaleCallbacks() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])

        coordinator.load(request: makeSampleRequest(id: "ep1"))
        let staleSession = coordinator.currentSessionId

        coordinator.load(request: makeSampleRequest(id: "ep2"))
        let activeSession = coordinator.currentSessionId

        avMock.simulateFirstFrameAndPlay(for: staleSession)
        XCTAssertTrue(coordinator.isPosterVisible, "Stale session must not hide poster")
        XCTAssertEqual(coordinator.currentState, .preparing)

        avMock.simulateFirstFrameAndPlay(for: activeSession)
        XCTAssertFalse(coordinator.isPosterVisible)
        XCTAssertEqual(coordinator.currentState, .playing)
    }

    func test02_SeekGuardBlocksOldProgressSnapBack() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])

        coordinator.load(request: makeSampleRequest(id: "ep1"))
        let sid = coordinator.currentSessionId
        avMock.simulateFirstFrameAndPlay(for: sid)
        avMock.simulateProgress(15.0, duration: 100.0, for: sid)

        coordinator.beginSeek(targetTime: 65.0)
        avMock.simulateProgress(16.0, duration: 100.0, for: sid)
        XCTAssertEqual(coordinator.currentTime, 65.0, accuracy: 0.01)

        coordinator.commitSeek(to: 65.0)
        avMock.simulateSeekComplete(65.0, for: sid)
        XCTAssertFalse(coordinator.isSeeking)
        avMock.simulateProgress(66.0, duration: 100.0, for: sid)
        XCTAssertEqual(coordinator.currentTime, 66.0, accuracy: 0.01)
    }

    func test03_BufferingDebouncePreventsSpinnerFlicker() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])
        coordinator.bufferingDebounceInterval = 0.30

        coordinator.load(request: makeSampleRequest(id: "ep1"))
        let sid = coordinator.currentSessionId
        avMock.simulateFirstFrameAndPlay(for: sid)

        avMock.delegate?.engine(avMock, didChangeState: .buffering, sessionId: sid)
        XCTAssertFalse(coordinator.isShowingLoading)
        avMock.delegate?.engine(avMock, didChangeState: .playing, sessionId: sid)
        XCTAssertFalse(coordinator.isShowingLoading)
    }

    func test04_CrossKernelSwitchStopsOldEngineFirst() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let cicadaMock = MockPlayerEngine(kernel: .cicadaPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock, .cicadaPlayer: cicadaMock])

        let req = EpisodePlayRequest(episodeId: "ep1", title: "Ep1", lines: [
            StreamLine(lineId: "l1", label: "AV", url: URL(string: "https://a.com/1.m3u8")!, kernel: .avPlayer),
            StreamLine(lineId: "l2", label: "Cicada", url: URL(string: "https://b.com/2.m3u8")!, kernel: .cicadaPlayer)
        ])
        coordinator.load(request: req)
        XCTAssertEqual(avMock.stopCount, 0)

        coordinator.switchLine(to: 1)
        XCTAssertEqual(avMock.stopCount, 1)
        XCTAssertEqual(cicadaMock.preparedURLs.count, 1)
    }

    func test05_FallbackLineLocksAfterSwitch() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])
        coordinator.load(request: makeSampleRequest(id: "ep1", lines: 2))
        coordinator.switchLine(to: 1)
        XCTAssertTrue(coordinator.isLockedOnFallbackLine)
    }

    func test06_TeardownInvalidatesActiveSession() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])
        coordinator.load(request: makeSampleRequest(id: "ep1"))
        let sid = coordinator.currentSessionId
        coordinator.teardown()
        avMock.simulateProgress(10.0, duration: 100.0, for: sid)
        XCTAssertEqual(coordinator.currentState, .idle)
    }

    func test07_EmptyStreamLinesTransitionsToError() {
        let coordinator = PlaybackSessionCoordinator()
        coordinator.load(request: EpisodePlayRequest(episodeId: "empty", title: "Empty", lines: []))
        if case .error(let code, _) = coordinator.currentState {
            XCTAssertEqual(code, -1001)
        } else {
            XCTFail("Expected error state for empty lines")
        }
    }

    func test08_RapidEpisodeSwitchingConvergesToLastEpisode() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])

        for i in 1...5 {
            coordinator.load(request: makeSampleRequest(id: "ep_\(i)"))
        }
        XCTAssertEqual(coordinator.currentRequest?.episodeId, "ep_5")
        XCTAssertEqual(coordinator.currentSessionId, 5)
    }

    func test09_AudioInterruptionPausesAndResumesAutomatically() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])
        let guardObj = IOSHardwareSessionGuard(coordinator: coordinator)

        coordinator.load(request: makeSampleRequest(id: "ep1"))
        avMock.simulateFirstFrameAndPlay(for: coordinator.currentSessionId)

        guardObj.handleAudioInterruption(began: true, shouldResume: false)
        XCTAssertEqual(coordinator.currentState, .paused)

        guardObj.handleAudioInterruption(began: false, shouldResume: true)
        XCTAssertEqual(coordinator.currentState, .playing)
    }

    func test10_HeadphonesDisconnectPausesImmediately() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])
        let guardObj = IOSHardwareSessionGuard(coordinator: coordinator)

        coordinator.load(request: makeSampleRequest(id: "ep1"))
        avMock.simulateFirstFrameAndPlay(for: coordinator.currentSessionId)

        guardObj.handleHeadphonesDisconnected()
        XCTAssertEqual(coordinator.currentState, .paused)
        XCTAssertTrue(coordinator.userManuallyPaused)
    }

    func test11_75PercentProgressTriggersNextEpisodePreloadAndMemoryPurge() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])
        let guardObj = IOSHardwareSessionGuard(coordinator: coordinator)

        var preloadedFromId: String?
        coordinator.onPreloadNextEpisode = { epId in
            preloadedFromId = epId
            guardObj.preloadNextEpisode(episodeId: "ep2", streamURL: URL(string: "https://cdn.example.com/ep2.m3u8")!)
        }

        coordinator.load(request: makeSampleRequest(id: "ep1"))
        let sid = coordinator.currentSessionId
        avMock.simulateProgress(76.0, duration: 100.0, for: sid)

        XCTAssertEqual(preloadedFromId, "ep1")
        XCTAssertTrue(guardObj.preloadedEpisodeIds.contains("ep2"))

        guardObj.purgePreloadCacheOnMemoryWarning()
        XCTAssertTrue(guardObj.preloadedEpisodeIds.isEmpty)
    }

    func test12_HTTP403TriggersSignedURLRefreshAndResumes() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])

        let refreshedURL = URL(string: "https://cdn.example.com/ep1/line0.m3u8?token=fresh_2026")!
        coordinator.onRefreshSignedURL = { _, _, completion in
            completion(refreshedURL)
        }

        coordinator.load(request: makeSampleRequest(id: "ep1"))
        let sid = coordinator.currentSessionId
        avMock.simulateError(code: 403, message: "Forbidden", for: sid)

        XCTAssertEqual(avMock.preparedURLs.last?.0, refreshedURL)
    }

    func test13_PlayingKeepsPosterUntilCurrentSessionFirstFrame() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])
        coordinator.load(request: makeSampleRequest(id: "ep1"))
        let staleSession = coordinator.currentSessionId
        coordinator.load(request: makeSampleRequest(id: "ep2"))

        coordinator.play()
        XCTAssertEqual(coordinator.currentState, .playing)
        XCTAssertTrue(coordinator.isPosterVisible, "Playing can precede video rendering")
        avMock.delegate?.engineDidRenderFirstFrame(avMock, sessionId: staleSession)
        XCTAssertTrue(coordinator.isPosterVisible)
        avMock.delegate?.engineDidRenderFirstFrame(avMock, sessionId: coordinator.currentSessionId)
        XCTAssertFalse(coordinator.isPosterVisible)
    }

    func test14_InterruptionDuringBufferingHonorsSubsequentManualPause() {
        let avMock = MockPlayerEngine(kernel: .avPlayer)
        let coordinator = PlaybackSessionCoordinator(engines: [.avPlayer: avMock])
        let hardwareGuard = IOSHardwareSessionGuard(coordinator: coordinator)
        coordinator.load(request: makeSampleRequest(id: "ep1"))
        avMock.delegate?.engine(avMock, didChangeState: .buffering, sessionId: coordinator.currentSessionId)

        hardwareGuard.handleAudioInterruption(began: true, shouldResume: false)
        XCTAssertEqual(avMock.pauseCount, 1)
        XCTAssertFalse(coordinator.userManuallyPaused)
        coordinator.pause(manual: true)
        hardwareGuard.handleAudioInterruption(began: false, shouldResume: true)
        XCTAssertEqual(avMock.playCount, 0)
        XCTAssertTrue(coordinator.userManuallyPaused)
    }
}
