#if canImport(UIKit)
import UIKit

@objc(SYDetailPlayerContainerView)
@objcMembers
public final class DetailPlayerContainerView: UIView {
    public let stageView: UIView = {
        let view = UIView()
        view.backgroundColor = .black
        view.clipsToBounds = true
        return view
    }()

    public let posterImageView: UIImageView = {
        let iv = UIImageView()
        iv.contentMode = .scaleAspectFill
        iv.clipsToBounds = true
        iv.backgroundColor = .black
        return iv
    }()

    public let progressSlider: UISlider = {
        let slider = UISlider()
        return slider
    }()

    private weak var mountedRenderView: UIView?
    private var isPosterVisible = true

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupSubviews()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupSubviews()
    }

    private func setupSubviews() {
        backgroundColor = .black
        clipsToBounds = true

        addSubview(stageView)
        stageView.addSubview(posterImageView)
        addSubview(progressSlider)
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        stageView.frame = bounds
        mountedRenderView?.frame = stageView.bounds
        posterImageView.frame = stageView.bounds
        let sliderHeight: CGFloat = 32
        progressSlider.frame = CGRect(
            x: 16,
            y: max(0, bounds.height - safeAreaInsets.bottom - sliderHeight - 8),
            width: max(0, bounds.width - 32),
            height: sliderHeight
        )
    }

    public func mountRenderView(_ renderView: UIView) {
        if mountedRenderView === renderView, renderView.superview === stageView {
            renderView.frame = stageView.bounds
            return
        }
        mountedRenderView?.removeFromSuperview()
        mountedRenderView = renderView
        renderView.translatesAutoresizingMaskIntoConstraints = true
        renderView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        renderView.frame = stageView.bounds
        stageView.insertSubview(renderView, belowSubview: posterImageView)
    }

    public func setPosterVisible(_ visible: Bool, animated: Bool = true) {
        isPosterVisible = visible
        let targetAlpha: CGFloat = visible ? 1.0 : 0.0
        if animated {
            UIView.animate(withDuration: 0.22) {
                self.posterImageView.alpha = targetAlpha
            }
        } else {
            posterImageView.alpha = targetAlpha
        }
    }

    public func setPosterImage(_ image: UIImage?) {
        posterImageView.image = image
        posterImageView.alpha = isPosterVisible ? 1 : 0
    }

    public func attachNavigationPopGestureExclusion(in navigationController: UINavigationController?) {
        guard let popGesture = navigationController?.interactivePopGestureRecognizer else { return }
        let shieldPan = UIPanGestureRecognizer()
        shieldPan.cancelsTouchesInView = false
        progressSlider.addGestureRecognizer(shieldPan)
        popGesture.require(toFail: shieldPan)
    }
}

public final class PlayerFullscreenViewController: UIViewController {
    public let stageHostView = UIView()

    public override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return [.top, .bottom]
    }

    public override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .landscapeRight
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        stageHostView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stageHostView)
        NSLayoutConstraint.activate([
            stageHostView.topAnchor.constraint(equalTo: view.topAnchor),
            stageHostView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stageHostView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stageHostView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
}

public final class PlayerFullscreenTransitionController {
    private weak var inlineContainer: DetailPlayerContainerView?
    private var fullscreenVC: PlayerFullscreenViewController?
    public private(set) var isFullscreen: Bool = false

    public init(inlineContainer: DetailPlayerContainerView) {
        self.inlineContainer = inlineContainer
    }

    public func enterFullscreen(from presenter: UIViewController) {
        guard !isFullscreen, let inlineContainer else { return }
        let fsVC = PlayerFullscreenViewController()
        fsVC.modalPresentationStyle = .fullScreen
        fullscreenVC = fsVC
        isFullscreen = true

        presenter.present(fsVC, animated: false) { [weak self] in
            guard let self else { return }
            self.reparentStage(inlineContainer.stageView, into: fsVC.stageHostView)
            self.requestIOS16GeometryOrientation(.landscapeRight, in: fsVC.view.window?.windowScene)
        }
    }

    public func exitFullscreen() {
        guard isFullscreen, let inlineContainer, let fsVC = fullscreenVC else { return }
        reparentStage(inlineContainer.stageView, into: inlineContainer)
        inlineContainer.sendSubviewToBack(inlineContainer.stageView)
        requestIOS16GeometryOrientation(.portrait, in: inlineContainer.window?.windowScene)

        fsVC.dismiss(animated: false) { [weak self] in
            self?.fullscreenVC = nil
            self?.isFullscreen = false
        }
    }

    private func reparentStage(_ stage: UIView, into targetParent: UIView) {
        stage.removeFromSuperview()
        stage.translatesAutoresizingMaskIntoConstraints = false
        targetParent.addSubview(stage)
        NSLayoutConstraint.activate([
            stage.topAnchor.constraint(equalTo: targetParent.topAnchor),
            stage.leadingAnchor.constraint(equalTo: targetParent.leadingAnchor),
            stage.trailingAnchor.constraint(equalTo: targetParent.trailingAnchor),
            stage.bottomAnchor.constraint(equalTo: targetParent.bottomAnchor)
        ])
    }

    private func requestIOS16GeometryOrientation(_ mask: UIInterfaceOrientationMask, in scene: UIWindowScene?) {
        if #available(iOS 16.0, *) {
            scene?.requestGeometryUpdate(.iOS(interfaceOrientations: mask))
        }
    }
}
#endif
