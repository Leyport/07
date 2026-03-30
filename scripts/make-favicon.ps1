Add-Type -AssemblyName System.Drawing

function Get-ResizedPngBytes {
    param([System.Drawing.Bitmap]$src, [int]$size)
    $dst = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $side = [Math]::Min($src.Width, $src.Height)
    $x = [int](($src.Width - $side) / 2)
    $y = [int](($src.Height - $side) / 2)
    $srcRect = New-Object System.Drawing.Rectangle $x, $y, $side, $side
    $dstRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $dst.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $dst.Dispose()
    return $ms.ToArray()
}

$src = [System.Drawing.Bitmap]::FromFile('C:\Users\user\Claude\Photos\Leyport dark.jpg')

$png16 = Get-ResizedPngBytes $src 16
$png32 = Get-ResizedPngBytes $src 32
$png48 = Get-ResizedPngBytes $src 48
$src.Dispose()

Write-Host "PNG sizes: $($png16.Count), $($png32.Count), $($png48.Count)"

$pngs = @($png16, $png32, $png48)
$count = $pngs.Count
$headerSize = 6 + 16 * $count

$offsets = @()
$offset = $headerSize
foreach ($p in $pngs) {
    $offsets += $offset
    $offset += $p.Count
}

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms

# ICONDIR header
$bw.Write([uint16]0)      # reserved
$bw.Write([uint16]1)      # 1 = ICO
$bw.Write([uint16]$count) # image count

# ICONDIRENTRY for each size
$widths = @(16, 32, 48)
for ($i = 0; $i -lt $count; $i++) {
    $bw.Write([byte]$widths[$i])   # width (0 = 256)
    $bw.Write([byte]$widths[$i])   # height
    $bw.Write([byte]0)             # color count
    $bw.Write([byte]0)             # reserved
    $bw.Write([uint16]1)           # planes
    $bw.Write([uint16]32)          # bits per pixel
    $bw.Write([uint32]$pngs[$i].Count)
    $bw.Write([uint32]$offsets[$i])
}

# Image data
for ($i = 0; $i -lt $count; $i++) {
    $bw.Write([byte[]]$pngs[$i], 0, $pngs[$i].Count)
}

$bw.Flush()
$bytes = $ms.ToArray()
$bw.Dispose()

[System.IO.File]::WriteAllBytes('C:\Users\user\Claude\Leyport\public\favicon.ico', $bytes)
Write-Host "favicon.ico written: $($bytes.Count) bytes"
