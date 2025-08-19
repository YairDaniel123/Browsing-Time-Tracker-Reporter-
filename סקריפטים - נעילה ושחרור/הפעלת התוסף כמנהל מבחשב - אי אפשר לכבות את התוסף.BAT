@echo off
:: ============================================================================
:: == Lock Chrome Extension - Prevents removal or disabling                ==
:: ==                                                                        ==
:: == This script adds a policy to the Windows Registry to force-install   ==
:: == the specified Chrome extension, making it unremovable by the user.   ==
:: ============================================================================
echo.

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Administrator permissions are required.
    echo Please right-click on this file and select "Run as administrator".
    echo.
    pause
    exit /b
)

:: 2. Set the extension details
set "extension_id=poidlldhphmffoefhfbidbihlcfgfgmh"
set "update_url=https://clients2.google.com/service/update2/crx"
set "reg_key=HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"

echo Applying policy for Chrome Extension ID: %extension_id%
echo This will make the extension unremovable by the user.
echo ----------------------------------------------------------------

:: 3. Create the necessary registry keys if they don't exist.
echo [+] Creating registry path...
reg add "HKLM\SOFTWARE\Policies\Google" /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Google\Chrome" /f >nul 2>&1
reg add "%reg_key%" /f >nul 2>&1

:: 4. Add the policy value to the registry. The /f flag forces overwrite.
echo [+] Adding extension policy to the registry...
reg add "%reg_key%" /v "1" /t REG_SZ /d "%extension_id%;%update_url%" /f

:: 5. Verify the result and provide feedback.
if %errorlevel% equ 0 (
    echo.
    echo =================================================================
    echo SUCCESS! The policy was added successfully.
    echo.
    echo --> IMPORTANT: Please restart the Chrome browser <--
    echo Close ALL Chrome windows for the change to take effect.
    echo =================================================================
) else (
    echo.
    echo =================================================================
    echo ERROR! Failed to write to the registry.
    echo =================================================================
)

echo.
pause