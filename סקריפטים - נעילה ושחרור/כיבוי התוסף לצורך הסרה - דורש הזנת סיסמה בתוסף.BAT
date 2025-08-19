@echo off
chcp 65001 > nul
:: ============================================================================
:: == Smart Unlock Chrome Extension - Token-Based Verification             ==
:: ==                                                                        ==
:: == This script first checks for a token file created by the extension.  ==
:: == The token is generated only after a successful password entry inside ==
:: == the extension's popup window.                                        ==
:: ============================================================================
echo.

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo שגיאה: נדרשות הרשאות מנהל.
    echo אנא לחץ קליק ימני על קובץ זה ובחר "הפעל כמנהל".
    echo.
    pause
    exit /b
)

:: 2. Define the path to the token file
:: %USERPROFILE% is a system variable pointing to the current user's folder (e.g., C:\Users\Username)
set "token_file=%USERPROFILE%\Downloads\ExtensionManager\unlock_token.txt"

echo =================================================================
echo  בודק אישור לשחרור נעילה מהתוסף...
echo =================================================================
echo.

:: 3. Check if the token file exists
if not exist "%token_file%" (
    echo *** שגיאה! לא נמצא אישור לשחרור נעילה. ***
    echo.
    echo אנא בצע את הפעולות הבאות:
    echo 1. פתח את החלון הקופץ של התוסף בדפדפן כרום.
    echo 2. הקש את הסיסמה כדי לשחרר את נעילת ההגדרות.
    echo 3. הפעל את הקובץ הזה שוב (כמנהל).
    echo.
    pause
    exit /b
)

echo [+] אישור נמצא! ממשיך בתהליך הסרת הנעילה...
timeout /t 2 /nobreak > nul

:: 4. Set the registry key and value name
set "reg_key=HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
set "value_name=1"

echo ----------------------------------------------------------------
echo [+] מוחק את ערך הרישום הנועל...
reg delete "%reg_key%" /v "%value_name%" /f

:: 5. Verify the result and provide feedback.
if %errorlevel% equ 0 (
    echo.
    echo =================================================================
    echo הצלחה! המדיניות הוסרה בהצלחה.
    echo.
    echo --> חשוב: יש להפעיל מחדש את דפדפן כרום <--
    echo =================================================================
) else (
    echo.
    echo =================================================================
    echo שגיאה! נכשל במחיקת ערך הרישום.
    echo =================================================================
)

:: 6. CRITICAL STEP: Delete the token file to make it single-use
echo [+] מוחק את אישור השחרור כדי למנוע שימוש חוזר...
del "%token_file%" >nul 2>&1
rmdir "%USERPROFILE%\Downloads\ExtensionManager" >nul 2>&1

echo.
pause