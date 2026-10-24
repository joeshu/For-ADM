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

let logPath = "dist/simulator-system.log"
if let logs = try? String(contentsOfFile: logPath, encoding: .utf8) {
    let matches = logs.split(separator: "\n").filter { line in
        let text = line.lowercased()
        return ["sanyuan", "exception", "terminating", "crash", "abort", "dyld", "failed", "error"].contains { text.contains($0) }
    }
    let summary = matches.suffix(14).joined(separator: " | ")
        .replacingOccurrences(of: "%", with: "%25")
        .replacingOccurrences(of: "\r", with: "%0D")
        .replacingOccurrences(of: "\n", with: "%0A")
    if !summary.isEmpty {
        print("SIMULATOR_APP_LOG: \(summary)")
        print("::error title=Simulator app log::\(String(summary.prefix(900)))")
    }
}
