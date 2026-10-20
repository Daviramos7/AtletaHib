Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$source = [System.Drawing.Image]::FromFile((Join-Path $root 'public\branding\atleta-hib-simbolo.png'))
$iconDir = Join-Path $root 'public\icons'

function Save-Icon([int] $Size, [string] $Name, [bool] $Maskable) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $canvas = [System.Drawing.Graphics]::FromImage($bitmap)
  $canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $canvas.Clear($(if ($Maskable) { [System.Drawing.Color]::FromArgb(255, 7, 10, 9) } else { [System.Drawing.Color]::Transparent }))
  $padding = if ($Maskable) { [int]($Size * .12) } else { [int]($Size * .16) }
  $canvas.DrawImage($source, $padding, $padding, $Size - (2 * $padding), $Size - (2 * $padding))
  $bitmap.Save((Join-Path $iconDir $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose(); $bitmap.Dispose()
}

Save-Icon 192 'atleta-hib-any-192.png' $false
Save-Icon 512 'atleta-hib-any-512.png' $false
Save-Icon 512 'atleta-hib-maskable-512.png' $true
Save-Icon 180 'atleta-hib-apple-touch-180.png' $false
$source.Dispose()
