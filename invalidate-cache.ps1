# CloudFront Cache Invalidation Script for Drum Painter
# Run this after deploying new builds to force CloudFront to serve fresh files

# Usage: .\invalidate-cache.ps1 [-DistributionId <id>]
# The ID can also come from the CLOUDFRONT_DISTRIBUTION_ID environment variable.
param(
    [string]$DistributionId = $(if ($env:CLOUDFRONT_DISTRIBUTION_ID) { $env:CLOUDFRONT_DISTRIBUTION_ID } else { "E3EX9JVKMSIGL9" })
)

# Configuration
$CLOUDFRONT_DISTRIBUTION_ID = $DistributionId

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Drum Painter - Cache Invalidation" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if AWS CLI is installed
Write-Host "Checking AWS CLI installation..." -ForegroundColor Yellow
try {
    $null = Get-Command aws -ErrorAction Stop
    Write-Host "AWS CLI found" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "AWS CLI is not installed." -ForegroundColor Red
    Write-Host "Please install it from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Check AWS credentials
Write-Host "Verifying AWS credentials..." -ForegroundColor Yellow
try {
    $callerIdentity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to get caller identity"
    }
    Write-Host "AWS credentials valid" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "AWS credentials not found or invalid." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please configure AWS CLI using one of these methods:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Method 1 - AWS CLI configure:" -ForegroundColor Cyan
    Write-Host "  aws configure"
    Write-Host ""
    Write-Host "Method 2 - Environment variables:" -ForegroundColor Cyan
    Write-Host "  Set AWS_ACCESS_KEY_ID"
    Write-Host "  Set AWS_SECRET_ACCESS_KEY"
    Write-Host "  Set AWS_DEFAULT_REGION"
    Write-Host ""
    exit 1
}

# Create CloudFront invalidation
Write-Host "Creating CloudFront invalidation for /drum-painter/*..." -ForegroundColor Yellow
Write-Host "Distribution ID: $CLOUDFRONT_DISTRIBUTION_ID" -ForegroundColor Gray
Write-Host ""

$INVALIDATION_ID = aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/drum-painter/*" --query 'Invalidation.Id' --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create invalidation:" -ForegroundColor Red
    Write-Host $INVALIDATION_ID
    Write-Host ""
    Write-Host "Please verify:" -ForegroundColor Yellow
    Write-Host "1. Distribution ID is correct"
    Write-Host "2. You have CloudFront permissions"
    Write-Host "3. The distribution exists and is deployed"
    Write-Host ""
    exit 1
}

Write-Host "Invalidation created successfully!" -ForegroundColor Green
Write-Host "Invalidation ID: $INVALIDATION_ID" -ForegroundColor Cyan
Write-Host ""

# Monitor invalidation status
Write-Host "Monitoring invalidation status..." -ForegroundColor Yellow
Write-Host "(This typically takes 1-5 minutes)" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date
$dotCount = 0

while ($true) {
    $STATUS = aws cloudfront get-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --id "$INVALIDATION_ID" --query 'Invalidation.Status' --output text 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Error checking status: $STATUS" -ForegroundColor Red
        Write-Host ""
        exit 1
    }

    $elapsed = (Get-Date) - $startTime
    $minutes = [int]$elapsed.TotalMinutes
    $seconds = $elapsed.Seconds
    $elapsedStr = "{0:D2}:{1:D2}" -f $minutes, $seconds

    # Show progress dots
    $dots = "." * ($dotCount % 4)
    $spaces = " " * (3 - ($dotCount % 4))
    Write-Host ("`rStatus: " + $STATUS + " " + $dots + $spaces + " (Elapsed: " + $elapsedStr + ")") -NoNewline -ForegroundColor Yellow

    if ($STATUS -eq "Completed") {
        Write-Host ""
        Write-Host ""
        Write-Host "================================" -ForegroundColor Green
        Write-Host "Invalidation Completed!" -ForegroundColor Green
        Write-Host "================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your changes should now be visible!" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Tip: If you still see old content, try:" -ForegroundColor Yellow
        Write-Host "  - Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)"
        Write-Host "  - Open in incognito/private window"
        Write-Host ""
        break
    }

    $dotCount++
    Start-Sleep -Seconds 5
}

Write-Host "Cache invalidation complete!" -ForegroundColor Green
Write-Host ""
