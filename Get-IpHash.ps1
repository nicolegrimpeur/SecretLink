<#
.SYNOPSIS
    Calcule le HMAC-SHA256 d'une IP, à l'identique de :
    crypto.createHmac('sha256', secret).update(ip).digest('hex')

.EXAMPLE
    # Secret via variable d'environnement (recommandé : évite l'historique shell)
    $env:IP_HMAC_SECRET = 'mon-secret'
    .\Get-IpHash.ps1 -Ip '203.0.113.42'

.EXAMPLE
    # Comparaison directe avec un hash trouvé dans les logs
    .\Get-IpHash.ps1 -Ip '203.0.113.42' -Expected 'a1b2c3...'

.EXAMPLE
    # Plusieurs IPs d'un coup
    '203.0.113.42', '198.51.100.7' | .\Get-IpHash.ps1
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory, ValueFromPipeline)]
    [string] $Ip,

    # Par défaut, lu depuis $env:IP_HMAC_SECRET
    [string] $Secret = $env:IP_HMAC_SECRET,

    # Hash attendu (issu des logs) pour comparaison automatique
    [string] $Expected,

    # Applique la même normalisation que le backend avant de hasher
    [switch] $Normalize
)

begin {
    if ([string]::IsNullOrEmpty($Secret)) {
        throw "Secret manquant. Définis `$env:IP_HMAC_SECRET ou passe -Secret."
    }

    $utf8  = [System.Text.Encoding]::UTF8
    $hmac  = [System.Security.Cryptography.HMACSHA256]::new($utf8.GetBytes($Secret))

    function Get-NormalizedIp {
        param([string] $Value)

        $out = $Value.Trim().ToLowerInvariant()

        # IPv4-mapped IPv6 : ::ffff:1.2.3.4 -> 1.2.3.4
        if ($out.StartsWith('::ffff:')) { $out = $out.Substring(7) }

        # IPv6 : troncature au /64
        if ($out.Contains(':') -and ($out -split ':').Count -gt 2) {
            $out = (($out -split ':')[0..3] -join ':') + '::'
        }

        return $out
    }
}

process {
    $input = if ($Normalize) { Get-NormalizedIp $Ip } else { $Ip }
    $bytes = $hmac.ComputeHash($utf8.GetBytes($input))
    $hash  = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''

    $result = [pscustomobject]@{
        Ip     = $Ip
        Hashed = $input
        Hash   = $hash
    }

    if ($PSBoundParameters.ContainsKey('Expected')) {
        $result | Add-Member -NotePropertyName Match `
                             -NotePropertyValue ($hash -eq $Expected.Trim().ToLowerInvariant())
    }

    $result
}

end {
    $hmac.Dispose()
}