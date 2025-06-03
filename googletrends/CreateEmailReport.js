// CreateEmailReport.js - Формирование HTML письма
const finalData = $input.item.json;

// Проверяем входные данные
if (!finalData || !finalData.success) {
  return [{
    success: false,
    emailSubject: '⚠️ TakeProfit Trends - Processing Error',
    emailBody: 'Error occurred during trends processing. Please check the workflow.'
  }];
}

// Функция создания HTML таблицы
function createEmailTable(trends, title, iconColor, maxRows = 10) {
  if (!trends || !trends.length) {
    return `<div style="text-align:center;padding:20px;background:#2d2d2d;border-radius:8px;margin:16px 0;border:1px solid #374151;">
      <p style="margin:0;color:#6b7280;font-size:12px;">No ${title.toLowerCase()} found</p>
    </div>`;
  }
  
  const catColors = {
    hot_stocks: {bg: 'rgba(239,68,68,0.1)', color: '#ef4444', icon: '📈'},
    hot_coins: {bg: 'rgba(251,191,36,0.1)', color: '#f59e0b', icon: '₿'},
    platforms: {bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6', icon: '🏛️'},
    tools: {bg: 'rgba(34,197,94,0.1)', color: '#22c55e', icon: '🛠️'}
  };
  
  let table = `
    <table style="width:100%;border-collapse:collapse;background:#1e1e1e;border-radius:8px;overflow:hidden;margin:16px 0;border:1px solid #374151;">
      <tr style="background:${iconColor};">
        <td colspan="6" style="padding:12px 16px;color:#fff;font-weight:600;font-size:14px;">
          ${title} (${trends.length})
        </td>
      </tr>
      <tr style="background:#2d2d2d;border-bottom:1px solid #374151;">
        <td style="padding:8px 12px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;">QUERY</td>
        <td style="padding:8px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;text-align:center;">CAT</td>
        <td style="padding:8px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;text-align:center;">VOL</td>
        <td style="padding:8px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;text-align:center;">COUNT</td>
        <td style="padding:8px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;text-align:center;">CONF</td>
        <td style="padding:8px 12px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;">REASONING</td>
      </tr>`;
  
  trends.slice(0, maxRows).forEach((trend, i) => {
    const bg = i % 2 ? '#252525' : '#1e1e1e';
    const vol = trend.current_volume >= 1000 ? `${(trend.current_volume/1000).toFixed(1)}K` : trend.current_volume;
    const cat = catColors[trend.ai_category] || catColors.tools;
    const isNew = trend.appearances_count === 1;
    const confidence = trend.ai_confidence || 0;
    
    table += `
      <tr style="background:${bg};border-bottom:1px solid #374151;">
        <td style="padding:8px 12px;">
          <a href="${trend.trends_link}" style="color:#60a5fa;text-decoration:none;font-weight:500;font-size:12px;" target="_blank">${trend.query}</a>
          ${isNew ? '<span style="background:#ef4444;color:#fff;padding:1px 4px;border-radius:2px;font-size:9px;margin-left:4px;font-weight:600;">NEW</span>' : ''}
        </td>
        <td style="text-align:center;padding:8px;">
          <span style="background:${cat.bg};color:${cat.color};padding:2px 4px;border-radius:3px;font-size:9px;font-weight:600;">${cat.icon}</span>
        </td>
        <td style="text-align:center;padding:8px;color:#fff;font-weight:600;font-size:11px;">${vol}</td>
        <td style="text-align:center;padding:8px;color:#10b981;font-weight:600;font-size:11px;">${trend.appearances_count}</td>
        <td style="text-align:center;padding:8px;color:#fff;font-weight:600;font-size:11px;">${confidence}/10</td>
        <td style="padding:8px 12px;color:#d1d5db;font-size:10px;line-height:1.2;">${trend.ai_reasoning || 'N/A'}</td>
      </tr>`;
  });
  
  return table + '</table>';
}

// Генерируем метаданные для письма
const reportTime = new Date().toLocaleString('en-US', {
  month: 'short', 
  day: 'numeric', 
  hour: '2-digit', 
  minute: '2-digit', 
  hour12: true
});

const summaryLink = `https://trends.google.com/trending?geo=${finalData.geoLocation}&category=3&hours=48`;
const sheetsLink = `https://docs.google.com/spreadsheets/d/1YourGoogleSheetIdHere/edit#gid=0`;

// Формируем тему письма
let emailSubject = `🚀 TakeProfit Trends`;
if (finalData.newRelevantInsights && finalData.newRelevantInsights.length > 0) {
  emailSubject += ` | ${finalData.newRelevantInsights.length} New Insights`;
}
if (finalData.categoryStats) {
  const stats = finalData.categoryStats;
  if (stats.hot_stocks > 0) emailSubject += ` | ${stats.hot_stocks} Stocks`;
  if (stats.hot_coins > 0) emailSubject += ` | ${stats.hot_coins} Coins`;
  if (stats.platforms > 0) emailSubject += ` | ${stats.platforms} Platforms`;
  if (stats.tools > 0) emailSubject += ` | ${stats.tools} Tools`;
}
emailSubject += ` | ${finalData.geoLocation}`;

// Формируем HTML тело письма
let emailBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TakeProfit Trends Report</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;">
  <table style="width:100%;max-width:1000px;margin:20px auto;background:#1a1a1a;border-radius:12px;border:1px solid #374151;">
    
    <!-- Header -->
    <tr>
      <td style="padding:20px 24px;background:linear-gradient(135deg,#059669 0%,#10b981 100%);">
        <table style="width:100%;">
          <tr>
            <td>
              <h1 style="margin:0 0 4px 0;color:#fff;font-size:20px;font-weight:700;">🚀 TakeProfit Trends Monitor</h1>
              <p style="margin:0;color:#d1fae5;font-size:11px;font-weight:500;">Smart Trading Intelligence • ${finalData.dataSource} • ${reportTime}</p>
            </td>
            <td style="text-align:right;">
              <a href="${sheetsLink}" style="background:rgba(255,255,255,0.2);color:#fff;padding:6px 12px;border-radius:4px;font-size:10px;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,0.3);margin:0 4px;" target="_blank">📊 Sheets</a>
              <a href="${summaryLink}" style="background:rgba(255,255,255,0.2);color:#fff;padding:6px 12px;border-radius:4px;font-size:10px;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,0.3);" target="_blank">📈 Trends</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Summary Stats -->
    <tr>
      <td style="padding:12px 24px;background:#252525;border-bottom:1px solid #374151;">
        <table style="width:100%;">
          <tr>
            <td style="color:#fff;font-size:14px;font-weight:600;">
              📊 Summary: ${finalData.newTrendsCount || 0} New • ${finalData.updatedTrendsCount || 0} Updated • ${(finalData.relevantInsights && finalData.relevantInsights.length) || 0} Relevant
            </td>
            <td style="text-align:right;">`;

// Добавляем бейджи категорий
if (finalData.categoryStats) {
  const stats = finalData.categoryStats;
  const badges = [];
  if (stats.hot_stocks > 0) badges.push(`<span style="background:#ef4444;color:#fff;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600;margin:0 2px;">stocks: ${stats.hot_stocks}</span>`);
  if (stats.hot_coins > 0) badges.push(`<span style="background:#f59e0b;color:#fff;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600;margin:0 2px;">coins: ${stats.hot_coins}</span>`);
  if (stats.platforms > 0) badges.push(`<span style="background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600;margin:0 2px;">platforms: ${stats.platforms}</span>`);
  if (stats.tools > 0) badges.push(`<span style="background:#22c55e;color:#fff;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600;margin:0 2px;">tools: ${stats.tools}</span>`);
  emailBody += badges.join('');
}

emailBody += `
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding:16px 24px;">`;

// Добавляем таблицы с данными
if (finalData.newRelevantInsights && finalData.newRelevantInsights.length > 0) {
  emailBody += createEmailTable(finalData.newRelevantInsights, '🆕 New Relevant Insights', '#059669');
}

if (finalData.relevantInsights && finalData.newRelevantInsights) {
  const existingRelevant = finalData.relevantInsights.filter(trend => 
    !finalData.newRelevantInsights.some(newTrend => newTrend.query === trend.query)
  );
  if (existingRelevant.length > 0) {
    emailBody += createEmailTable(existingRelevant, '📈 Updated Relevant Trends', '#0ea5e9');
  }
}

// Если нет релевантных инсайтов
if (!finalData.relevantInsights || finalData.relevantInsights.length === 0) {
  emailBody += `
    <div style="text-align:center;padding:40px;background:#2d2d2d;border-radius:8px;margin:16px 0;border:1px solid #374151;">
      <h2 style="margin:0 0 8px 0;color:#f8fafc;font-size:16px;font-weight:600;">No Relevant Insights Found</h2>
      <p style="margin:0 0 16px 0;color:#94a3b8;font-size:14px;">Processed ${finalData.totalProcessed || 0} trends</p>
      <p style="margin:0;color:#6b7280;font-size:12px;">Location: ${finalData.geoLocation || 'Unknown'}</p>
    </div>`;
}

emailBody += `
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding:12px 24px;background:#252525;border-top:1px solid #374151;">
        <table style="width:100%;">
          <tr>
            <td style="color:#9ca3af;font-size:10px;">
              <strong>Analysis Summary:</strong> ${finalData.totalProcessed || 0} trends processed • ${finalData.geoLocation || 'Unknown'} • ${finalData.dataSource || 'Unknown'}
            </td>
            <td style="text-align:right;">
              <a href="https://takeprofit.com" style="color:#10b981;font-size:10px;text-decoration:none;font-weight:600;" target="_blank">🚀 TakeProfit.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
  </table>
</body>
</html>`;

console.log(`Email report generated: ${emailSubject}`);

// Возвращаем результат
return [{
  success: true,
  emailSubject: emailSubject,
  emailBody: emailBody,
  totalProcessed: finalData.totalProcessed || 0,
  newInsights: (finalData.newRelevantInsights && finalData.newRelevantInsights.length) || 0,
  relevantTotal: (finalData.relevantInsights && finalData.relevantInsights.length) || 0,
  categoryStats: finalData.categoryStats || {}
}];
