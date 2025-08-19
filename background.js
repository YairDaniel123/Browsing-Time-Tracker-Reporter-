// =================================================================
// ניהול מצב, מעקב, והאזנה לאירועים
// =================================================================

// משתנה גלובלי שיחזיק את מצב ההפעלה כדי למנוע קריאות חוזרות ל-storage
let isTrackingGloballyActive = true;

async function updateTrackingStatus() {
  const { isTrackingActive } = await chrome.storage.sync.get({ isTrackingActive: true });
  isTrackingGloballyActive = isTrackingActive;

  // עדכון ויזואלי של האייקון
  if (isTrackingGloballyActive) {
    chrome.action.setIcon({ path: {
        "16": "images/icon16.png",
        "48": "images/icon48.png",
        "128": "images/icon128.png"
    }});
  } else {
    // אם המעקב כבוי, נשנה את האייקון לאפור
    chrome.action.setIcon({ path: {
        "16": "images/icon16_disabled.png",
        "48": "images/icon48_disabled.png",
        "128": "images/icon128_disabled.png"
    }});
    // חשוב: נקה את הזמן הנוכחי שנמדד כדי לא לצבור זמן כשהתוסף "כבוי"
    await recordTime(); 
  }
}

// האזן להודעה מה-popup כדי לרענן את המצב
chrome.runtime.onMessage.addListener((message) => {
    if (message.trackingStatusChanged) {
        updateTrackingStatus();
    }
});

// הפעל את הבדיקה הראשונית כשהתוסף נטען
updateTrackingStatus();


async function setState(state) { await chrome.storage.local.set({ trackingState: state }); }
async function getState() { const result = await chrome.storage.local.get('trackingState'); return result.trackingState || { activeDomain: null, startTime: null, activeTitle: null }; }
async function getUsageData() { const result = await chrome.storage.local.get('usage'); return result.usage || {}; }
async function saveUsageData(usage) { await chrome.storage.local.set({ usage: usage }); }
function getDomain(url) { if (!url || !url.startsWith('http')) { return null; } try { return new URL(url).hostname; } catch { return null; } }

async function recordTime() {
  const state = await getState();
  if (state.activeDomain && state.startTime) {
    const duration = (Date.now() - state.startTime) / 1000;
    if (duration > 1) {
      const usage = await getUsageData();
      if (!usage[state.activeDomain]) {
        usage[state.activeDomain] = { seconds: 0, title: state.activeTitle || state.activeDomain };
      }
      usage[state.activeDomain].seconds += duration;
      usage[state.activeDomain].title = state.activeTitle || state.activeDomain;
      await saveUsageData(usage);
    }
  }
  await setState({ activeDomain: null, startTime: null, activeTitle: null });
}

async function startTracking() {
  if (!isTrackingGloballyActive) {
    await recordTime();
    return;
  }
  
  await recordTime();
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab) {
    const domain = getDomain(activeTab.url);
    if (domain) {
      await setState({
        activeDomain: domain,
        startTime: Date.now(),
        activeTitle: activeTab.title 
      });
    }
  }
}

chrome.tabs.onActivated.addListener(startTracking);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === 'complete' && tab.url) { startTracking(); }
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) { await recordTime(); } else { await startTracking(); }
});
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') { await recordTime(); } else if (state === 'active') { await startTracking(); }
});

// =================================================================
// דוח תקופתי - פעם ב-24 שעות
// =================================================================
chrome.alarms.create('dailyReport', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReport') {
    if (!isTrackingGloballyActive) {
      console.log('Tracking is disabled, skipping daily report.');
      return;
    }
    
    await recordTime();
    const usage = await getUsageData();
    if (Object.keys(usage).length > 0) {
      await sendEmailReport(usage);
      const settings = await chrome.storage.sync.get({ downloadCsvEnabled: false });
      if (settings.downloadCsvEnabled) {
        saveReportCSV(usage);
      }
      await saveUsageData({});
    }
  }
});

// =================================================================
// פונקציית שמירת ה-CSV
// =================================================================
function saveReportCSV(reportData) {
  let csvHeaders = '"שם האתר (דומיין)","כותרת האתר","זמן גלישה (דקות)"\n';
  let csvRows = "";
  for (const [domain, data] of Object.entries(reportData)) {
    const title = data.title || domain;
    const cleanTitle = title.replace(/"/g, '""'); 
    csvRows += `"${domain}","${cleanTitle}","${(data.seconds / 60).toFixed(1)}"\n`;
  }
  const bom = "\ufeff";
  const csvContent = bom + csvHeaders + csvRows;
  const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  chrome.downloads.download({
    url: dataUri,
    filename: `browsing_report_${new Date().toISOString().slice(0, 10)}.csv`,
    saveAs: false
  });
}

// =================================================================
// פונקציית שליחת המייל
// =================================================================
async function sendEmailReport(reportData) {
  const data = await chrome.storage.sync.get('recipientEmail');
  const recipientEmail = data.recipientEmail;

  if (!recipientEmail) {
    console.log('לא הוגדרה כתובת מייל למשלוח דוחות. התהליך נעצר.');
    return;
  }

  const serverUrl = 'https://zeta-olive-64.vercel.app/api/send-email';
  let reportBody = 'סיכום זמן הגלישה שלך להיום:\n\n';
  for (const [domain, data] of Object.entries(reportData)) {
    const minutes = (data.seconds / 60).toFixed(1);
    reportBody += `- ${data.title || domain} (${domain}): ${minutes} דקות\n`;
  }
  const emailContent = {
    to: recipientEmail,
    subject: `דוח גלישה יומי - ${new Date().toLocaleString('he-IL')}`,
    body: reportBody
  };
  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailContent)
    });
    if (response.ok) {
      console.log('דוח המייל נשלח בהצלחה!');
    } else {
      console.error('שגיאה בשליחת המייל:', await response.text());
    }
  } catch (error) {
    console.error('שגיאה קריטית בשליחת המייל:', error);
  }
}
