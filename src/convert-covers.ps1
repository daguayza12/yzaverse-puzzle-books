# Convert cropped front-cover PDFs to JPG using Windows Runtime PDF API

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

# Helper to await WinRT async operations from PowerShell
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

# Load WinRT types
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

$coversDir = Join-Path $PSScriptRoot "..\covers"
$pdfs = Get-ChildItem -Path $coversDir -Filter "*-front.pdf"

foreach ($pdf in $pdfs) {
    $slug = $pdf.BaseName -replace '-front$', ''
    $outPath = Join-Path $coversDir "$slug.jpg"

    if (Test-Path $outPath) {
        Write-Host "[SKIP] $slug.jpg exists"
        continue
    }

    Write-Host "[CONVERT] $slug..."

    try {
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdf.FullName)) ([Windows.Storage.StorageFile])
        $pdfDoc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
        $page = $pdfDoc.GetPage(0)

        $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream

        # Render at high DPI
        $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
        $ratio = $page.Size.Width / $page.Size.Height
        $options.DestinationHeight = 2700
        $options.DestinationWidth = [uint32]($ratio * 2700)

        AwaitAction ($page.RenderToStreamAsync($stream, $options))

        # Read rendered PNG from stream into System.Drawing
        $stream.Seek(0)
        $dotnetStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
        $bitmap = [System.Drawing.Image]::FromStream($dotnetStream)

        # Save as JPEG
        $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 90L)
        $bitmap.Save($outPath, $jpegCodec, $encoderParams)

        $w = $bitmap.Width
        $h = $bitmap.Height
        $bitmap.Dispose()
        $dotnetStream.Dispose()
        $stream.Dispose()
        $page.Dispose()

        Write-Host "[DONE] $slug.jpg (${w}x${h})"
    }
    catch {
        Write-Host "[FAIL] $slug : $_"
    }
}

Write-Host "`nDone. Check ./covers/"
