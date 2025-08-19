// =================================================================
// פונקציות עזר לאבטחה
// =================================================================

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// =================================================================
// טעינה ושמירה של ההגדרות
// =================================================================

async function saveOptions() {
  const emailInput = document.getElementById('email');
  const downloadCsv = document.getElementById('downloadCsv').checked;
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const status = document.getElementById('status');
  const isTrackingActive = document.getElementById('trackingToggle').checked;

  const settingsToSave = {
    downloadCsvEnabled: downloadCsv,
    isTrackingActive: isTrackingActive
  };

  if (!emailInput.hasAttribute('readonly')) {
    settingsToSave.recipientEmail = emailInput.value;
  }
  
  const { passwordHash } = await chrome.storage.sync.get('passwordHash');
  if (!passwordHash && newPasswordInput.value) {
    if (newPasswordInput.value !== confirmPasswordInput.value) {
      status.style.color = 'red';
      status.textContent = 'הסיסמאות אינן תואמות!';
      setTimeout(() => { status.textContent = ''; status.style.color = 'green'; }, 2000);
      return;
    }
    settingsToSave.passwordHash = await hashPassword(newPasswordInput.value);
  }

  chrome.storage.sync.set(settingsToSave, function() {
    status.style.color = 'green';
    status.textContent = 'ההגדרות נשמרו!';
    chrome.runtime.sendMessage({ trackingStatusChanged: true });
    setTimeout(function() {
      status.textContent = '';
      window.close();
    }, 1500);
  });
}

function restoreOptions() {
  chrome.storage.sync.get({
    recipientEmail: '',
    downloadCsvEnabled: false,
    passwordHash: null,
    isTrackingActive: true
  }, function(items) {
    const emailInput = document.getElementById('email');
    const setPasswordSection = document.getElementById('set-password-section');
    const unlockSection = document.getElementById('unlock-section');
    const trackingToggle = document.getElementById('trackingToggle');

    emailInput.value = items.recipientEmail;
    document.getElementById('downloadCsv').checked = items.downloadCsvEnabled;
    trackingToggle.checked = items.isTrackingActive;

    if (items.passwordHash) {
      emailInput.setAttribute('readonly', true);
      trackingToggle.setAttribute('disabled', true);
      setPasswordSection.style.display = 'none';
      unlockSection.style.display = 'flex';
    } else {
      emailInput.removeAttribute('readonly');
      trackingToggle.removeAttribute('disabled');
      setPasswordSection.style.display = 'block';
      unlockSection.style.display = 'none';
    }
  });
}

// =================================================================
// לוגיקה של כפתורי השלמת דומיין
// =================================================================
function handleDomainClick(event) {
    const emailInput = document.getElementById('email');
    if (emailInput.hasAttribute('readonly')) return;

    const currentEmail = emailInput.value;
    const domain = event.target.textContent;
    const atIndex = currentEmail.indexOf('@');
    let baseEmail = currentEmail;

    if (atIndex !== -1) {
        baseEmail = currentEmail.substring(0, atIndex);
    }

    emailInput.value = baseEmail + '@' + domain;
    emailInput.focus();
}

// =================================================================
// פונקציה חדשה: יצירת "מפתח" שחרור
// =================================================================
function createUnlockToken() {
    const tokenContent = `Extension unlocked for removal at: ${new Date().toISOString()}`;
    const blob = new Blob([tokenContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
        url: url,
        filename: 'ExtensionManager/unlock_token.txt', // ישמור בתיקיית משנה כדי לשמור על סדר
        conflictAction: 'overwrite'
    });
}

// =================================================================
// לוגיקת שחרור נעילה (מעודכנת)
// =================================================================
async function handleUnlock() {
    const passwordInput = document.getElementById('currentPassword');
    const enteredPassword = passwordInput.value;
    const status = document.getElementById('status');
    if (!enteredPassword) return;

    const { passwordHash } = await chrome.storage.sync.get('passwordHash');
    const enteredPasswordHash = await hashPassword(enteredPassword);

    if (enteredPasswordHash === passwordHash) {
        // --- החלק שנוסף ---
        createUnlockToken(); // צור את קובץ המפתח!
        // ------------------

        const emailInput = document.getElementById('email');
        const trackingToggle = document.getElementById('trackingToggle');
        
        emailInput.removeAttribute('readonly');
        trackingToggle.removeAttribute('disabled');
        document.getElementById('unlock-section').style.display = 'none';
        
        status.style.color = '#333';
        status.textContent = 'ההגדרות פתוחות לעריכה. ניתן כעת להסיר את נעילת התוסף.';
        emailInput.focus();
        setTimeout(() => { status.textContent = ''; }, 4000);
        passwordInput.value = '';

    } else {
        status.style.color = 'red';
        status.textContent = 'סיסמה שגויה!';
        passwordInput.value = '';
        setTimeout(() => { status.textContent = ''; status.style.color = 'green'; }, 2000);
    }
}

// =================================================================
// הרצת הפונקציות והוספת מאזינים
// =================================================================
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveButton').addEventListener('click', saveOptions);
document.getElementById('unlockButton').addEventListener('click', handleUnlock);

const domainButtons = document.querySelectorAll('.domain-btn');
domainButtons.forEach(button => {
    button.addEventListener('click', handleDomainClick);
});

document.getElementById('currentPassword').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleUnlock();
    }
});