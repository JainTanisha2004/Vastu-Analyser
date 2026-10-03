# ---------------------------------------------------------
#  Vastu Analyser - one-click local launcher
#  Run from project root:  .\start.ps1
# ---------------------------------------------------------

[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$BackendPort = 8000,

    [switch]$NoReload,
    [switch]$NoBrowser,
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backendDirectory = Join-Path $root "backend"
$frontendDirectory = Join-Path $root "frontend"
$pythonPath = Join-Path $backendDirectory "venv\Scripts\python.exe"
$frontendPort = 5173

function Test-TcpPortAvailable {
    param([int]$Port)

    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener(
            [System.Net.IPAddress]::Loopback,
            $Port
        )
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $listener) {
            $listener.Stop()
        }
    }
}

function Find-AvailableBackendPort {
    param([int]$PreferredPort)

    $lastCandidate = [Math]::Min(65535, $PreferredPort + 20)
    for ($candidate = $PreferredPort + 1; $candidate -le $lastCandidate; $candidate++) {
        if (Test-TcpPortAvailable -Port $candidate) {
            return $candidate
        }
    }
    return $null
}

function Test-VastuBackend {
    param([string]$BaseUrl)

    try {
        $health = Invoke-RestMethod -Uri "$BaseUrl/" -TimeoutSec 2 -UseBasicParsing
        return (
            $health.status -eq "ok" -and
            $health.message -eq "Vastu Analyser API is running"
        )
    }
    catch {
        return $false
    }
}

function Test-VastuFrontend {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing
        return (
            $response.StatusCode -eq 200 -and
            $response.Content -match "Vastu Analyser"
        )
    }
    catch {
        return $false
    }
}

function Wait-ForVastuBackend {
    param(
        [string]$BaseUrl,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-VastuBackend -BaseUrl $BaseUrl) {
            return $true
        }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Wait-ForVastuFrontend {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        if (Test-VastuFrontend -Url $Url) {
            return $true
        }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)
    return $false
}

if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    throw "Backend virtual environment not found at '$pythonPath'."
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($null -eq $npmCommand) {
    throw "npm.cmd was not found. Install Node.js or add it to PATH."
}

Write-Host ""
Write-Host "  ========================================" -ForegroundColor DarkYellow
Write-Host "       Vastu Analyser - Local Start       " -ForegroundColor DarkYellow
Write-Host "  ========================================" -ForegroundColor DarkYellow
Write-Host ""

$requestedBackendUrl = "http://127.0.0.1:$BackendPort"
$backendIsRunning = Test-VastuBackend -BaseUrl $requestedBackendUrl
$selectedBackendPort = $BackendPort

if (-not $backendIsRunning -and -not (Test-TcpPortAvailable -Port $BackendPort)) {
    $selectedBackendPort = Find-AvailableBackendPort -PreferredPort $BackendPort
    if ($null -eq $selectedBackendPort) {
        throw "Backend ports $BackendPort through $([Math]::Min(65535, $BackendPort + 20)) are unavailable."
    }
    Write-Host "  [INFO] Port $BackendPort is owned or reserved; using $selectedBackendPort." -ForegroundColor Yellow
}

$backendUrl = "http://127.0.0.1:$selectedBackendPort"
$frontendUrl = "http://127.0.0.1:$FrontendPort"
$frontendIsRunning = Test-VastuFrontend -Url $frontendUrl
$frontendPortAvailable = Test-TcpPortAvailable -Port $FrontendPort

if ($frontendIsRunning -and $selectedBackendPort -ne 8000) {
    throw "A Vastu frontend is already running on port $FrontendPort with an unknown API setting. Close it and run this launcher again."
}
if (-not $frontendIsRunning -and -not $frontendPortAvailable) {
    throw "Frontend port $FrontendPort is already in use by another application. Close that application and run this launcher again."
}

if ($CheckOnly) {
    if ($backendIsRunning) {
        Write-Host "  [CHECK] Healthy Vastu backend will be reused at $backendUrl" -ForegroundColor Green
    }
    else {
        Write-Host "  [CHECK] Backend can start at $backendUrl" -ForegroundColor Green
    }
    if ($frontendIsRunning) {
        Write-Host "  [CHECK] Healthy Vastu frontend will be reused at $frontendUrl" -ForegroundColor Green
    }
    else {
        Write-Host "  [CHECK] Frontend can start at $frontendUrl" -ForegroundColor Green
    }
    Write-Host "  [CHECK] No processes were started." -ForegroundColor DarkGray
    return
}

if ($backendIsRunning) {
    Write-Host "  [1/2] Reusing healthy backend at $backendUrl" -ForegroundColor Green
}
else {
    Write-Host "  [1/2] Starting backend at $backendUrl ..." -ForegroundColor Cyan
    $backendArguments = @(
        "-m", "uvicorn", "main:app",
        "--host", "127.0.0.1",
        "--port", $selectedBackendPort.ToString()
    )
    if (-not $NoReload) {
        $backendArguments += "--reload"
    }

    # These are intentionally visible: users stop the local servers from the
    # two interactive terminal windows created by this launcher.
    $backendProcess = Start-Process `
        -FilePath $pythonPath `
        -ArgumentList $backendArguments `
        -WorkingDirectory $backendDirectory `
        -PassThru

    if (-not (Wait-ForVastuBackend -BaseUrl $backendUrl)) {
        throw "Backend did not become healthy at $backendUrl within 30 seconds. Check process $($backendProcess.Id)'s terminal for the actual error."
    }
    Write-Host "        Backend health check passed." -ForegroundColor Green
}

if ($frontendIsRunning) {
    Write-Host "  [2/2] Reusing healthy frontend at $frontendUrl" -ForegroundColor Green
}
else {
    Write-Host "  [2/2] Starting frontend at $frontendUrl ..." -ForegroundColor Cyan
    $previousApiBaseUrl = $env:VITE_API_BASE_URL
    try {
        $env:VITE_API_BASE_URL = $backendUrl
        $frontendProcess = Start-Process `
            -FilePath $npmCommand.Source `
            -ArgumentList @(
                "run", "dev", "--",
                "--host", "127.0.0.1",
                "--port", $FrontendPort.ToString(),
                "--strictPort"
            ) `
            -WorkingDirectory $frontendDirectory `
            -PassThru
    }
    finally {
        if ($null -eq $previousApiBaseUrl) {
            Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
        }
        else {
            $env:VITE_API_BASE_URL = $previousApiBaseUrl
        }
    }

    if (-not (Wait-ForVastuFrontend -Url $frontendUrl)) {
        throw "Frontend did not become healthy at $frontendUrl within 30 seconds. Check process $($frontendProcess.Id)'s terminal for the actual error."
    }
    Write-Host "        Frontend readiness check passed." -ForegroundColor Green
}

Write-Host ""
Write-Host "  [OK] Backend  -> $backendUrl" -ForegroundColor Green
Write-Host "  [OK] Frontend -> $frontendUrl" -ForegroundColor Green
Write-Host ""

if (-not $NoBrowser) {
    Write-Host "  Opening browser..." -ForegroundColor Yellow
    Start-Process -FilePath $frontendUrl
}

Write-Host "  Close the server terminals (or press Ctrl+C in each) to stop new processes." -ForegroundColor DarkGray
if ($backendIsRunning -or $frontendIsRunning) {
    Write-Host "  Reused servers must be stopped from their original terminals." -ForegroundColor DarkGray
}
Write-Host ""
