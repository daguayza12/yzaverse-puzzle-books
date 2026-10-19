# Extract FRONT and BACK covers from wrap-around PDFs
# PDFs are landscape (back+spine+front left-to-right)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

function Await($WinRtTask, $ResultType) {
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

function AwaitAction($WinRtTask) {
    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethod('AsTask',
        [Type[]]@([Windows.Foundation.IAsyncAction]))
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
}

$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

$coversDir = Join-Path $PSScriptRoot "..\covers"

# Use original full wrap PDFs from Downloads
$downloads = "C:\Users\Diana\Downloads"
$coverMap = @{
    'calm-sudoku-puzzle-book' = 'Calm_Sudoku_Puzzle 2708584 (CMYK)\Paperback Cover (Calm_Sudoku_Puzzle) 6X9 110 pages Bleed CMYK.pdf'
    'hoot-and-solve-sudoku-for-kids' = 'Hoot_Solve_Sudoku_Puzzle 3098635 (CMYK)\Paperback Cover (Hoot_Solve_Sudoku_Puzzle) 6X9 110 pages Bleed CMYK.pdf'
    'nyc-word-search-puzzle-book' = 'NYC_6x9_Word_Search 2690694 (CMYK)\Paperback Cover (NYC_6x9_Word_Search) 6X9 110 pages Bleed CMYK.pdf'
    'slow-and-solve-sudoku-for-kids' = 'Slow_Solve_Sudoku_Puzzle 3098803 (CMYK)\Paperback Cover (Slow_Solve_Sudoku_Puzzle) 6X9 110 pages Bleed CMYK.pdf'
}

foreach ($entry in $coverMap.GetEnumerator()) {
    $slug = $entry.Key
    $pdfPath = Join-Path $downloads $entry.Value

    Write-Host "`n[PROCESS] $slug"

    if (-not (Test-Path $pdfPath)) {
        Write-Host "  [MISS] PDF not found"
        continue
    }

    try {
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdfPath)) ([Windows.Storage.StorageFile])
        $pdfDoc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
        $page = $pdfDoc.GetPage(0)

        $pageW = $page.Size.Width
        $pageH = $page.Size.Height
        Write-Host "  PDF page: ${pageW}x${pageH} pts"

        # Render at high res, force landscape dimensions
        $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
        $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions

        # PDF is 900x666 (landscape). Render width=2700, height=1998
        $scale = 3
        $options.DestinationWidth = [uint32]($pageW * $scale)
        $options.DestinationHeight = [uint32]($pageH * $scale)

        AwaitAction ($page.RenderToStreamAsync($stream, $options))

        $stream.Seek(0)
        $dotnetStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
        $fullBitmap = [System.Drawing.Bitmap]::new($dotnetStream)

        $fullW = $fullBitmap.Width
        $fullH = $fullBitmap.Height
        Write-Host "  Rendered: ${fullW}x${fullH}"

        # Wrap layout (left to right): back cover | spine | front cover
        # For 6x9 book with ~110 pages: spine ~0.3", total width ~12.5"
        # back ~6.25", spine ~0.3", front ~6.25" (roughly)
        # So front starts at about 52-55% from left
        # Back ends at about 45-48% from left

        $frontX = [int]($fullW * 0.52)
        $frontW = $fullW - $frontX
        $backW = [int]($fullW * 0.48)

        $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 90L)

        # Front cover - crop right portion, resize to 600w
        $frontRect = New-Object System.Drawing.Rectangle($frontX, 0, $frontW, $fullH)
        $frontBmp = $fullBitmap.Clone($frontRect, $fullBitmap.PixelFormat)
        $targetW = 600
        $targetH = [int]($frontBmp.Height * ($targetW / $frontBmp.Width))
        $frontResized = New-Object System.Drawing.Bitmap($frontBmp, $targetW, $targetH)
        $frontPath = Join-Path $coversDir "$slug.jpg"
        $frontResized.Save($frontPath, $jpegCodec, $encoderParams)
        Write-Host "  [DONE] Front: $slug.jpg (${targetW}x${targetH})"
        $frontResized.Dispose()
        $frontBmp.Dispose()

        # Back cover - crop left portion, resize to 600w
        $backRect = New-Object System.Drawing.Rectangle(0, 0, $backW, $fullH)
        $backBmp = $fullBitmap.Clone($backRect, $fullBitmap.PixelFormat)
        $backTargetH = [int]($backBmp.Height * ($targetW / $backBmp.Width))
        $backResized = New-Object System.Drawing.Bitmap($backBmp, $targetW, $backTargetH)
        $backPath = Join-Path $coversDir "$slug-back.jpg"
        $backResized.Save($backPath, $jpegCodec, $encoderParams)
        Write-Host "  [DONE] Back: $slug-back.jpg (${targetW}x${backTargetH})"
        $backResized.Dispose()
        $backBmp.Dispose()

        $fullBitmap.Dispose()
        $dotnetStream.Dispose()
        $stream.Dispose()
        $page.Dispose()
    }
    catch {
        Write-Host "  [FAIL] $slug : $_"
    }
}

Write-Host "`nDone."
