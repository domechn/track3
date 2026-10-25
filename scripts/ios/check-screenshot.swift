import AppKit
import Foundation

guard CommandLine.arguments.count == 2,
      let bitmap = NSBitmapImageRep(data: try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))) else {
    fatalError("Simulator screenshot is missing or unreadable")
}

var colors: [Int: Int] = [:]
var samples = 0
let xStep = max(1, bitmap.pixelsWide / 120)
let yStep = max(1, bitmap.pixelsHigh / 120)
for y in stride(from: bitmap.pixelsHigh / 10, to: bitmap.pixelsHigh * 9 / 10, by: yStep) {
    for x in stride(from: 0, to: bitmap.pixelsWide, by: xStep) {
        guard let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else {
            continue
        }
        let red = Int(color.redComponent * 15)
        let green = Int(color.greenComponent * 15)
        let blue = Int(color.blueComponent * 15)
        let key = (red << 8) | (green << 4) | blue
        colors[key, default: 0] += 1
        samples += 1
    }
}

let varied = samples - (colors.values.max() ?? 0)
guard samples > 0, varied >= max(30, samples / 20) else {
    fatalError("Simulator screenshot is nearly uniform; the webview may be blank")
}
print("Screenshot has \(varied) varied samples out of \(samples)")
