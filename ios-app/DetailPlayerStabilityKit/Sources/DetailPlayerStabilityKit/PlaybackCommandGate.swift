import Foundation

/// The Objective-C player stack has several asynchronous event sources. This
/// gate is the single authority for deciding which session/engine/seek event
/// may change detail playback state.
@objc(SYPlaybackCommandGate)
public final class PlaybackCommandGate: NSObject {
    private let lock = NSRecursiveLock()
    private var nextSession: UInt64 = 0
    private var nextAttempt: UInt64 = 0
    private var nextSeek: UInt64 = 0
    private var context = ""
    private var episodeKey = ""
    private var activeAttempt: UInt64 = 0
    private var activeKernel = ""
    private var pendingSeek: (id: UInt64, attempt: UInt64, target: Double)?
    private var confirmedTime: Double = 0
    private var duration: Double = 0
    private var stableProgressPosition: Double = 0
    private var wantsToPlay = true
    private var restartCount = 0
    private var crossLineCount = 0
    private var recoveryStartedAt: TimeInterval?
    private var lastEventSequence: UInt64 = 0

    @objc(beginSessionWithContext:episodeKey:initialPosition:)
    public func beginSession(context: String, episodeKey: String, initialPosition: Double) -> UInt64 {
        lock.lock(); defer { lock.unlock() }
        nextSession &+= 1
        self.context = context
        self.episodeKey = episodeKey
        activeAttempt = 0
        activeKernel = ""
        pendingSeek = nil
        confirmedTime = initialPosition.isFinite ? max(0, initialPosition) : 0
        stableProgressPosition = confirmedTime
        duration = 0
        wantsToPlay = true
        restartCount = 0
        crossLineCount = 0
        recoveryStartedAt = nil
        lastEventSequence = 0
        return nextSession
    }

    @objc(beginAttemptWithContext:kernel:)
    public func beginAttempt(context: String, kernel: String) -> UInt64 {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context, !context.isEmpty else { return 0 }
        nextAttempt &+= 1
        activeAttempt = nextAttempt
        activeKernel = kernel
        pendingSeek = nil
        lastEventSequence = 0
        return activeAttempt
    }

    @objc(acceptsEventWithContext:attempt:sequence:)
    public func acceptsEvent(context: String, attempt: UInt64, sequence: UInt64) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context, attempt != 0, attempt == activeAttempt,
              sequence > lastEventSequence else { return false }
        lastEventSequence = sequence
        return true
    }

    @objc(acceptsIdentityWithContext:attempt:)
    public func acceptsIdentity(context: String, attempt: UInt64) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return context == self.context && attempt != 0 && attempt == activeAttempt
    }

    @objc(beginSeekWithContext:target:duration:)
    public func beginSeek(context: String, target: Double, duration: Double) -> UInt64 {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context, activeAttempt != 0, target.isFinite, target >= 0 else { return 0 }
        let safeDuration = duration.isFinite && duration > 0 ? duration : self.duration
        let clamped = safeDuration > 1 ? min(target, safeDuration - 1) : target
        nextSeek &+= 1
        pendingSeek = (nextSeek, activeAttempt, clamped)
        return nextSeek
    }

    @objc(finishSeekWithContext:attempt:seekID:actualPosition:)
    public func finishSeek(context: String, attempt: UInt64, seekID: UInt64, actualPosition: Double) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context, attempt == activeAttempt, actualPosition.isFinite,
              let pendingSeek, pendingSeek.id == seekID, pendingSeek.attempt == attempt else { return false }
        let tolerance = max(1.5, min(4.0, pendingSeek.target * 0.005))
        guard abs(actualPosition - pendingSeek.target) <= tolerance else { return false }
        confirmedTime = max(0, actualPosition)
        stableProgressPosition = confirmedTime
        self.pendingSeek = nil
        return true
    }

    @objc(cancelSeekWithContext:attempt:seekID:)
    public func cancelSeek(context: String, attempt: UInt64, seekID: UInt64) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context, attempt == activeAttempt,
              let pendingSeek, pendingSeek.id == seekID, pendingSeek.attempt == attempt else { return false }
        self.pendingSeek = nil
        return true
    }

    @objc(acceptsProgressWithContext:attempt:sequence:position:duration:)
    public func acceptsProgress(context: String, attempt: UInt64, sequence: UInt64, position: Double, duration: Double) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context, attempt != 0, attempt == activeAttempt,
              pendingSeek == nil, sequence > lastEventSequence,
              position.isFinite, position >= 0,
              position + 1.0 >= confirmedTime else { return false }
        lastEventSequence = sequence
        if position >= stableProgressPosition + 10 {
            // Only real forward playback opens a fresh recovery window.
            // Preparing or seeking alone must not make a failing stream loop.
            restartCount = 0
            crossLineCount = 0
            recoveryStartedAt = nil
            stableProgressPosition = position
        }
        confirmedTime = position
        if duration.isFinite && duration > 0 { self.duration = duration }
        return true
    }

    /// All automatic re-prepares, including engine fallback and URL refresh,
    /// consume this same session budget. Cross-line changes have a sub-limit.
    @objc(authorizeRecoveryWithContext:crossLine:)
    public func authorizeRecovery(context: String, crossLine: Bool) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context, !context.isEmpty else { return false }
        let now = ProcessInfo.processInfo.systemUptime
        if let started = recoveryStartedAt, now - started >= 90 { return false }
        if restartCount >= 3 || (crossLine && crossLineCount >= 2) { return false }
        if recoveryStartedAt == nil { recoveryStartedAt = now }
        restartCount += 1
        if crossLine { crossLineCount += 1 }
        return true
    }

    @objc(setWantsToPlayWithContext:wantsToPlay:)
    public func setWantsToPlay(context: String, wantsToPlay: Bool) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context else { return false }
        self.wantsToPlay = wantsToPlay
        return true
    }

    @objc(desiredPlaybackWithContext:)
    public func desiredPlayback(context: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return context == self.context && wantsToPlay
    }

    @objc(confirmedPositionWithContext:)
    public func confirmedPosition(context: String) -> Double {
        lock.lock(); defer { lock.unlock() }
        return context == self.context ? (pendingSeek?.target ?? confirmedTime) : 0
    }

    @objc(stopWithContext:)
    public func stop(context: String) {
        lock.lock(); defer { lock.unlock() }
        guard context == self.context else { return }
        context = ""
        episodeKey = ""
        activeAttempt = 0
        activeKernel = ""
        pendingSeek = nil
        wantsToPlay = false
    }
}
