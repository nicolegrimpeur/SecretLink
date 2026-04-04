# Script de chargement des variables d'environnement pour le développement local
# À utiliser avant de lancer docker compose : . .env.local.ps1

if (-Not (Test-Path ".\.env")) {
    Write-Host "❌ Fichier .env non trouvé !" -ForegroundColor Red
    Write-Host ""
    Write-Host "Crée .env à partir de .env.example :" -ForegroundColor Yellow
    Write-Host "  copy .env.example .env" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Pour générer les tokens sécurisés :" -ForegroundColor Yellow
    Write-Host "  openssl rand -base64 32" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Charge TOUTES les variables depuis .env
$loadedVars = @()
$content = Get-Content ".\.env"
foreach ($line in $content) {
    # Ignore les lignes vides et les commentaires
    if ($line -match "^\s*$" -or $line -match "^\s*#") {
        continue
    }
    
    # Parse les lignes KEY=VALUE
    if ($line -match "^([A-Z_]+)=(.*)$") {
        $varName = $matches[1]
        $varValue = $matches[2]
        
        # Définit la variable d'environnement
        Set-Variable -Name "env:$varName" -Value $varValue
        $loadedVars += $varName
    }
}

# Affiche les variables chargées
Write-Host "✓ Variables d'environnement chargées :" -ForegroundColor Green
$loadedVars | ForEach-Object { Write-Host "  • $_" -ForegroundColor Cyan }
Write-Host ""
