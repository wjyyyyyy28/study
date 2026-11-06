Add-Type -AssemblyName System.Drawing

$iconDirectory = Join-Path $PSScriptRoot "..\icons"
New-Item -ItemType Directory -Force -Path $iconDirectory | Out-Null

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-YantuIcon {
  param(
    [int]$Size,
    [string]$FileName,
    [bool]$Maskable = $false
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#f4f0e7"))

  $background = [System.Drawing.SolidBrush]::new(
    [System.Drawing.ColorTranslator]::FromHtml("#1f2d27")
  )
  $cream = [System.Drawing.Pen]::new(
    [System.Drawing.ColorTranslator]::FromHtml("#f3ecdd"),
    [float]($Size * 0.052)
  )
  $cream.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $cream.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $coral = [System.Drawing.SolidBrush]::new(
    [System.Drawing.ColorTranslator]::FromHtml("#ef835f")
  )

  $padding = if ($Maskable) { $Size * 0.12 } else { $Size * 0.035 }
  $cardWidth = $Size - ($padding * 2)
  $cardPath = New-RoundedRectanglePath `
    -X $padding `
    -Y $padding `
    -Width $cardWidth `
    -Height $cardWidth `
    -Radius ($Size * 0.22)
  $graphics.FillPath($background, $cardPath)

  $graphics.FillEllipse(
    $coral,
    [float]($Size * 0.69),
    [float]($Size * 0.17),
    [float]($Size * 0.12),
    [float]($Size * 0.12)
  )

  $mainCurve = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $mainCurve.AddBezier(
    [float]($Size * 0.20),
    [float]($Size * 0.64),
    [float]($Size * 0.39),
    [float]($Size * 0.63),
    [float]($Size * 0.51),
    [float]($Size * 0.29),
    [float]($Size * 0.68),
    [float]($Size * 0.27)
  )
  $mainCurve.AddBezier(
    [float]($Size * 0.68),
    [float]($Size * 0.27),
    [float]($Size * 0.81),
    [float]($Size * 0.28),
    [float]($Size * 0.80),
    [float]($Size * 0.43),
    [float]($Size * 0.65),
    [float]($Size * 0.47)
  )
  $graphics.DrawPath($cream, $mainCurve)

  $stem = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $stem.AddBezier(
    [float]($Size * 0.24),
    [float]($Size * 0.78),
    [float]($Size * 0.43),
    [float]($Size * 0.70),
    [float]($Size * 0.57),
    [float]($Size * 0.51),
    [float]($Size * 0.64),
    [float]($Size * 0.38)
  )
  $graphics.DrawPath($cream, $stem)

  $graphics.FillEllipse(
    $coral,
    [float]($Size * 0.59),
    [float]($Size * 0.38),
    [float]($Size * 0.027),
    [float]($Size * 0.027)
  )

  $outputPath = Join-Path $iconDirectory $FileName
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $mainCurve.Dispose()
  $stem.Dispose()
  $cardPath.Dispose()
  $cream.Dispose()
  $coral.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-YantuIcon -Size 192 -FileName "icon-192.png"
New-YantuIcon -Size 512 -FileName "icon-512.png"
New-YantuIcon -Size 512 -FileName "icon-maskable-512.png" -Maskable $true
