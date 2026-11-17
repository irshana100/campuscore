$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'

function Wait-ForHttpUrl {
    param(
        [Parameter(Mandatory = $true)] [string] $Url,
        [int] $TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -Method Get
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    return $false
}

function Get-PythonExecutable {
    $candidates = @(
        (Join-Path $backendDir '.venv\Scripts\python.exe'),
        'C:\Users\ASUS\AppData\Local\Programs\Python\Python312\python.exe',
        'py'
    )

    foreach ($candidate in $candidates) {
        if ($candidate -eq 'py') {
            try {
                & py -3 --version | Out-Null
                return 'py'
            } catch {
                continue
            }
        }

        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw 'Python executable not found. Install Python 3.12 or create the project virtual environment.'
}

function Get-NpmExecutable {
    $candidates = @(
        'C:\Program Files\nodejs\npm.cmd',
        'npm.cmd',
        'npm'
    )

    foreach ($candidate in $candidates) {
        try {
            if ($candidate -eq 'npm' -or $candidate -eq 'npm.cmd') {
                & $candidate --version | Out-Null
                return $candidate
            }

            if (Test-Path $candidate) {
                return $candidate
            }
        } catch {
            continue
        }
    }

    throw 'npm was not found. Install Node.js and ensure npm is on PATH.'
}

$backendPython = Get-PythonExecutable
$npmCommand = Get-NpmExecutable

$backendRunning = Test-NetConnection -ComputerName 127.0.0.1 -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $backendRunning) {
    Write-Host 'Starting backend API...'
    if ($backendPython -eq 'py') {
        Start-Process -FilePath 'py' -ArgumentList '-3', 'run.py' -WorkingDirectory $backendDir -WindowStyle Minimized
    } else {
        Start-Process -FilePath $backendPython -ArgumentList 'run.py' -WorkingDirectory $backendDir -WindowStyle Minimized
    }

    $ready = Wait-ForHttpUrl -Url 'http://127.0.0.1:5000' -TimeoutSeconds 60
    if (-not $ready) {
        throw 'Backend did not start successfully on port 5000.'
    }
    Write-Host 'Backend is running on http://127.0.0.1:5000'
} else {
    Write-Host 'Backend is already running on port 5000.'
}

$frontendRunning = Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $frontendRunning) {
    Write-Host 'Starting frontend dev server...'
    if ($npmCommand -eq 'npm' -or $npmCommand -eq 'npm.cmd') {
        Start-Process -FilePath $npmCommand -ArgumentList 'run','dev','--','--host','0.0.0.0' -WorkingDirectory $frontendDir -WindowStyle Minimized
    } else {
        Start-Process -FilePath $npmCommand -ArgumentList 'run dev -- --host 0.0.0.0' -WorkingDirectory $frontendDir -WindowStyle Minimized
    }

    $ready = Wait-ForHttpUrl -Url 'http://127.0.0.1:5173' -TimeoutSeconds 60
    if (-not $ready) {
        throw 'Frontend did not start successfully on port 5173.'
    }
    Write-Host 'Frontend is running on http://127.0.0.1:5173'
} else {
    Write-Host 'Frontend is already running on port 5173.'
}

Start-Process 'http://127.0.0.1:5173/login'
Write-Host 'Opening the College Management System login page...'
Write-Host "Project root: $repoRoot"
