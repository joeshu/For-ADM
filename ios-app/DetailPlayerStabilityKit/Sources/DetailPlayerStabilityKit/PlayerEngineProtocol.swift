import Foundation
import AVFoundation

#if canImport(UIKit)
import UIKit
public typealias PlatformRenderView = UIView
#else
import AppKit
public typealias PlatformRenderView = NSView
#endif

public enum PlayerKernelType: String, Codable, Sendable {
    case avPlayer = "AVPlayer"
    case cicadaPlayer = "CicadaPlayer"
    case sfPlayer = "SFPlayer"
}

public enum PlaybackState: Equatable, Sendable {
    case idle
    case preparing
    case playing
    case buffering
    case paused
    case ended
    case error(code: Int, message: String)

    public var isActivelyPlaying: Bool {
        if case .playing = self { return true }
        return false
    }
}

public struct StreamLine: Equatable, Sendable {
    public let lineId: String
    public let label: String
    public let url: URL
    public let kernel: PlayerKernelType

    public init(lineId: String, label: String, url: URL, kernel: PlayerKernelType = .avPlayer) {
        self.lineId = lineId
        self.label = label
        self.url = url
        self.kernel = kernel
    }
}

public struct EpisodePlayRequest: Equatable, Sendable {
    public let episodeId: String
    public let title: String
    public let lines: [StreamLine]
    public let initialPosition: TimeInterval

    public init(episodeId: String, title: String, lines: [StreamLine], initialPosition: TimeInterval = 0) {
        self.episodeId = episodeId
        self.title = title
        self.lines = lines
        self.initialPosition = initialPosition
    }
}

public protocol PlayerEngineDelegate: AnyObject {
    func engine(_ engine: PlayerEngineProtocol, didChangeState state: PlaybackState, sessionId: UInt64)
    func engine(_ engine: PlayerEngineProtocol, didUpdateProgress currentTime: TimeInterval, duration: TimeInterval, sessionId: UInt64)
    func engineDidRenderFirstFrame(_ engine: PlayerEngineProtocol, sessionId: UInt64)
    func engineDidCompleteSeek(_ engine: PlayerEngineProtocol, position: TimeInterval, sessionId: UInt64)
}

public protocol PlayerEngineProtocol: AnyObject {
    var kernelType: PlayerKernelType { get }
    var activeSessionId: UInt64 { get }
    var delegate: PlayerEngineDelegate? { get set }
    var renderView: PlatformRenderView { get }

    func prepare(url: URL, startPosition: TimeInterval, sessionId: UInt64)
    func play()
    func pause()
    func seek(to seconds: TimeInterval, sessionId: UInt64)
    func stopAndRelease()
}

public final class AVPlayerEngine: NSObject, PlayerEngineProtocol {
    public let kernelType: PlayerKernelType = .avPlayer
    public private(set) var activeSessionId: UInt64 = 0
    public weak var delegate: PlayerEngineDelegate?
    public let renderView: PlatformRenderView

    private var player: AVPlayer?
    private var timeObserverToken: Any?
    private var statusObservation: NSKeyValueObservation?
    private var bufferEmptyObservation: NSKeyValueObservation?
    private var likelyToKeepUpObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?

    public override init() {
        self.renderView = PlatformRenderView()
        super.init()
    }

    public func prepare(url: URL, startPosition: TimeInterval, sessionId: UInt64) {
        stopAndRelease()
        activeSessionId = sessionId
        delegate?.engine(self, didChangeState: .preparing, sessionId: sessionId)

        let asset = AVURLAsset(url: url)
        let item = AVPlayerItem(asset: asset)
        item.preferredForwardBufferDuration = 4.0

        let avPlayer = AVPlayer(playerItem: item)
        self.player = avPlayer

        #if canImport(UIKit)
        let layer = AVPlayerLayer(player: avPlayer)
        layer.videoGravity = .resizeAspect
        layer.frame = renderView.bounds
        renderView.layer.sublayers?.forEach { $0.removeFromSuperlayer() }
        renderView.layer.addSublayer(layer)
        #endif

        statusObservation = item.observe(\.status, options: [.new]) { [weak self] observedItem, _ in
            guard let self, self.activeSessionId == sessionId else { return }
            switch observedItem.status {
            case .readyToPlay:
                self.delegate?.engineDidRenderFirstFrame(self, sessionId: sessionId)
                if startPosition > 0 {
                    self.seek(to: startPosition, sessionId: sessionId)
                }
                avPlayer.play()
                self.delegate?.engine(self, didChangeState: .playing, sessionId: sessionId)
            case .failed:
                let nsErr = observedItem.error as NSError?
                let code = nsErr?.code ?? -1
                let msg = nsErr?.localizedDescription ?? "AVPlayerItem failed"
                self.delegate?.engine(self, didChangeState: .error(code: code, message: msg), sessionId: sessionId)
            default:
                break
            }
        }

        bufferEmptyObservation = item.observe(\.isPlaybackBufferEmpty, options: [.new]) { [weak self] observedItem, _ in
            guard let self, self.activeSessionId == sessionId else { return }
            if observedItem.isPlaybackBufferEmpty {
                self.delegate?.engine(self, didChangeState: .buffering, sessionId: sessionId)
            }
        }

        likelyToKeepUpObservation = item.observe(\.isPlaybackLikelyToKeepUp, options: [.new]) { [weak self] observedItem, _ in
            guard let self, self.activeSessionId == sessionId else { return }
            if observedItem.isPlaybackLikelyToKeepUp && avPlayer.rate > 0 {
                self.delegate?.engine(self, didChangeState: .playing, sessionId: sessionId)
            }
        }

        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserverToken = avPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] cmTime in
            guard let self, self.activeSessionId == sessionId else { return }
            let current = CMTimeGetSeconds(cmTime)
            let total = CMTimeGetSeconds(item.duration)
            if current.isFinite && total.isFinite && total > 0 {
                self.delegate?.engine(self, didUpdateProgress: current, duration: total, sessionId: sessionId)
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            guard let self, self.activeSessionId == sessionId else { return }
            self.delegate?.engine(self, didChangeState: .ended, sessionId: sessionId)
        }
    }

    public func play() {
        player?.play()
        delegate?.engine(self, didChangeState: .playing, sessionId: activeSessionId)
    }

    public func pause() {
        player?.pause()
        delegate?.engine(self, didChangeState: .paused, sessionId: activeSessionId)
    }

    public func seek(to seconds: TimeInterval, sessionId: UInt64) {
        guard activeSessionId == sessionId, let player else { return }
        let target = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] finished in
            guard let self, finished, self.activeSessionId == sessionId else { return }
            self.delegate?.engineDidCompleteSeek(self, position: seconds, sessionId: sessionId)
        }
    }

    public func stopAndRelease() {
        if let token = timeObserverToken {
            player?.removeTimeObserver(token)
            timeObserverToken = nil
        }
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        statusObservation?.invalidate()
        bufferEmptyObservation?.invalidate()
        likelyToKeepUpObservation?.invalidate()
        statusObservation = nil
        bufferEmptyObservation = nil
        likelyToKeepUpObservation = nil

        player?.pause()
        player?.replaceCurrentItem(with: nil)
        player = nil
        activeSessionId = 0
    }
}
