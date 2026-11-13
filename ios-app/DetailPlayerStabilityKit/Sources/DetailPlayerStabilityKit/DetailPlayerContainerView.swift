#if canImport(UIKit)
import UIKit

public final class DetailPlayerContainerView: UIView {
    public let stageView: UIView = {
        let view = UIView()
        view.backgroundColor = .black
        view.clipsToBounds = true
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    public let posterImageView: UIImageView = {
        let iv = UIImageView()
        iv.contentMode = .scaleAspectFill
        iv.clipsToBounds = true
        iv.backgroundColor = .black
        iv.translatesAutoresizingMaskIntoConstraints = false
        return iv
    }()

    public let progressSlider: UISlider = {
        let slider = UISlider()
        slider.translatesAutoresizingMaskIntoConstraints = false
        return slider
    }()

    private weak var mountedRenderView: UIView?

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupLockedAspectRatio()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupLockedAspectRatio()
    }

    private func setupLockedAspectRatio() {
        backgroundColor = .black
        clipsToBounds = true
        translatesAutoresizingMaskIntoConstraints = false

        let aspectConstraint = heightAnchor.constraint(equalTo: widthAnchor, multiplier: 9.0 / 16.0)
        aspectConstraint.priority = .required
        aspectConstraint.isActive = true

        addSubview(stageView)
        stageView.addSubview(posterImageView)
        addSubview(progressSlider)

        NSLayoutConstraint.activate([
            stageView.topAnchor.constraint(equalTo: topAnchor),
            stageView.leadingAnchor.constraint(equalTo: leadingAnchor),
            stageView.trailingAnchor.constraint(equalTo: trailingAnchor),
            stageView.bottomAnchor.constraint(equalTo: bottomAnchor),

            posterImageView.topAnchor.constraint(equalTo: stageView.topAnchor),
            posterImageView.leadingAnchor.constraint(equalTo: stageView.leadingAnchor),
            posterImageView.trailingAnchor.constraint(equalTo: stageView.trailingAnchor),
            posterImageView.bottomAnchor.constraint(equalTo: stageView.bottomAnchor),

            progressSlider.leadingAnchor.constraint(equalTo: safeAreaLayoutGuide.leadingAnchor, constant: 16),
            progressSlider.trailingAnchor.constraint(equalTo: safeAreaLayoutGuide.trailingAnchor, constant: -16),
            progressSlider.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -8)
        ])
    }

    public func mountRenderView(_ renderView: UIView) {
        mountedRenderView = renderView
        renderView.translatesAutoresizingMaskIntoConstraints = false
        stageView.insertSubview(renderView, belowSubview: posterImageView)
        NSLayoutConstraint.activate([
            renderView.topAnchor.constraint(equalTo: stageView.topAnchor),
            renderView.leadingAnchor.constraint(equalTo: stageView.leadingAnchor),
            renderView.trailingAnchor.constraint(equalTo: stageView.trailingAnchor),
            renderView.bottomAnchor.constraint(equalTo: stageView.bottomAnchor)
        ])
    }

    public func setPosterVisible(_ visible: Bool, animated: Bool = true) {
        let targetAlpha: CGFloat = visible ? 1.0 : 0.0
        if animated {
            UIView.animate(withDuration: 0.22) {
                self.posterImageView.alpha = targetAlpha
            }
        } else {
            posterImageView.alpha = targetAlpha
        }
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
