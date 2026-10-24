import Foundation
import ImageIO
import Vision

let path = "dist/simulator-failure.png"
guard FileManager.default.fileExists(atPath: path),
      let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    print("::error::Simulator failure screenshot was not created.")
    exit(0)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "en-US"]
request.usesLanguageCorrection = false
do {
    try VNImageRequestHandler(cgImage: image).perform([request])
    let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    let text = lines.joined(separator: " | ").replacingOccurrences(of: "\n", with: " ")
    print("SIMULATOR_FAILURE_SCREEN_TEXT: \(text)")
    if !text.isEmpty {
        let safe = String(text.prefix(900))
            .replacingOccurrences(of: "%", with: "%25")
            .replacingOccurrences(of: "\r", with: "%0D")
            .replacingOccurrences(of: "\n", with: "%0A")
    print("::error title=Simulator failure screen::\(safe)")
    }
} catch {
    print("::error title=Simulator screenshot OCR::\(error.localizedDescription)")
}
