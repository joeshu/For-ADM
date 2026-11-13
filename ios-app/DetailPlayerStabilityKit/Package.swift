// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DetailPlayerStabilityKit",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "DetailPlayerStabilityKit",
            targets: ["DetailPlayerStabilityKit"]
        )
    ],
    targets: [
        .target(
            name: "DetailPlayerStabilityKit",
            path: "Sources/DetailPlayerStabilityKit",
            swiftSettings: [
                .unsafeFlags(["-O"], .when(configuration: .release))
            ]
        ),
        .testTarget(
            name: "DetailPlayerStabilityKitTests",
            dependencies: ["DetailPlayerStabilityKit"],
            path: "Tests/DetailPlayerStabilityKitTests"
        )
    ]
)
