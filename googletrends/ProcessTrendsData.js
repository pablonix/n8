const inputData = $input.all();

let responseData;

if (inputData[0].json.testData && inputData[0].json.testData.trim() !== '') {
  console.log('Using test data');
  try {
    responseData = JSON.parse(inputData[0].json.testData);
  } catch (e) {
    return [{
      success: false,
      error: 'Invalid test JSON data: ' + e.message,
      emailBody: 'Error: Invalid test JSON data provided.',
      rawData: []
    }];
  }
} else {
  console.log('Using real API data');
  responseData = inputData[0].json;
}

if (responseData.error) {
  return [{
    success: false,
    error: `SerpAPI Error: ${responseData.error}`,
    emailBody: `Error: SerpAPI returned an error - ${responseData.error}`,
    rawData: []
  }];
}

const trendingSearches = responseData.trending_searches || [];

if (trendingSearches.length === 0) {
  return [{
    success: false,
    error: 'No trending searches found',
    emailBody: 'No trending searches found in API response.',
    rawData: []
  }];
}

// ИСПРАВЛЕННАЯ функция проверки Business & Finance категории
function isStrictBusinessFinanceTrend(trend) {
  if (!trend.categories || !Array.isArray(trend.categories)) {
    console.log(`Trend "${trend.query}" has no categories`);
    return false;
  }
  
  const hasBusinessFinance = trend.categories.some(category => {
    // Строгая проверка по ID
    if (category.id === 7) {
      console.log(`Trend "${trend.query}" has Business & Finance ID: 7`);
      return true;
    }
    
    // Строгая проверка по названию
    if (category.name) {
      const categoryName = category.name.toLowerCase();
      const isBusinessFinance = categoryName === 'business & finance' || 
                               categoryName === 'business and finance' ||
                               categoryName === 'business' ||
                               categoryName === 'finance';
      
      if (isBusinessFinance) {
        console.log(`Trend "${trend.query}" has Business & Finance name: "${category.name}"`);
        return true;
      }
    }
    
    return false;
  });
  
  if (!hasBusinessFinance) {
    console.log(`Trend "${trend.query}" EXCLUDED - categories: ${trend.categories.map(c => c.name || c.id).join(', ')}`);
  }
  
  return hasBusinessFinance;
}

// Фильтруем только тренды с Business & Finance категорией
const allBusinessTrends = trendingSearches.filter(isStrictBusinessFinanceTrend);

console.log(`Filtered ${allBusinessTrends.length} Business & Finance trends from ${trendingSearches.length} total`);

// ИСПРАВЛЕННОЕ разделение на pure и mixed
const pureBusinessTrends = allBusinessTrends.filter(trend => {
  // Pure = только одна категория И она Business & Finance
  if (trend.categories.length !== 1) {
    return false;
  }
  
  const category = trend.categories[0];
  const isPureBF = category.id === 7 || 
                   (category.name && (
                     category.name.toLowerCase() === 'business & finance' ||
                     category.name.toLowerCase() === 'business and finance' ||
                     category.name.toLowerCase() === 'business' ||
                     category.name.toLowerCase() === 'finance'
                   ));
  
  if (isPureBF) {
    console.log(`Pure B&F: "${trend.query}" - ${category.name || category.id}`);
  }
  
  return isPureBF;
});

const mixedBusinessTrends = allBusinessTrends.filter(trend => {
  // Mixed = больше одной категории И одна из них Business & Finance
  if (trend.categories.length <= 1) {
    return false;
  }
  
  console.log(`Mixed B&F: "${trend.query}" - ${trend.categories.map(c => c.name || c.id).join(', ')}`);
  return true;
});

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function createTrendsLink(query, geo) {
  const encodedQuery = encodeURIComponent(query);
  const geoCode = geo || 'US';
  return `https://trends.google.com/trends/explore?date=now%207-d&geo=${geoCode}&q=${encodedQuery}&hl=en`;
}

function processTrends(trends, geo) {
  return trends.map((trend, index) => ({
    id: index + 1,
    query: trend.query || 'Unknown Query',
    searchVolume: trend.search_volume || 0,
    increasePercentage: trend.increase_percentage || 0,
    timestamp: formatTimestamp(trend.start_timestamp),
    active: trend.active === true,
    categories: (trend.categories || []).map(cat => cat.name || `Category ${cat.id}`),
    categoriesDisplay: (trend.categories || []).map(cat => cat.name || `Category ${cat.id}`).join(' • '),
    trendBreakdown: (trend.trend_breakdown || []).join(' • '),
    trendsLink: createTrendsLink(trend.query || 'Unknown Query', geo)
  }));
}

const geoLocation = responseData.search_parameters?.geo || 'US';
const processedPureTrends = processTrends(pureBusinessTrends, geoLocation);
const processedMixedTrends = processTrends(mixedBusinessTrends, geoLocation);

processedPureTrends.sort((a, b) => b.searchVolume - a.searchVolume);
processedMixedTrends.sort((a, b) => b.searchVolume - a.searchVolume);

function formatTrendsTable(trends, sectionTitle, isPure = true) {
  if (trends.length === 0) return '';
  
  const headerBg = isPure ? '#0ea5e9' : '#8b5cf6';
  
  let table = `
    <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 16px 0; background: #1e1e1e; border-radius: 8px; border: 1px solid #374151; overflow: hidden;">
      <tr>
        <td colspan="6" style="padding: 12px 16px; background: ${headerBg}; color: #ffffff; font-size: 14px; font-weight: 600;">
          ${sectionTitle} (${trends.length})
        </td>
      </tr>
      <tr style="background: #2d2d2d; border-bottom: 1px solid #374151;">
        <td style="padding: 8px 12px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 35%;">Search Term</td>
        <td style="padding: 8px 12px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; text-align: center; width: 12%;">Volume</td>
        <td style="padding: 8px 12px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; text-align: center; width: 10%;">Change</td>
        <td style="padding: 8px 12px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; text-align: center; width: 8%;">Status</td>
        <td style="padding: 8px 12px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 20%;">Categories</td>
        <td style="padding: 8px 12px; color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 15%;">Start Time</td>
      </tr>`;
  
  trends.forEach((trend, index) => {
    const rowBg = index % 2 === 0 ? '#1e1e1e' : '#252525';
    const statusColor = trend.active ? '#ef4444' : '#6b7280';
    const statusBg = trend.active ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)';
    const statusText = trend.active ? 'LIVE' : 'Recent';
    const volumeDisplay = trend.searchVolume >= 1000 ? 
      `${(trend.searchVolume / 1000).toFixed(1)}K` : 
      trend.searchVolume.toLocaleString();
    
    table += `
      <tr style="background: ${rowBg}; border-bottom: 1px solid #374151;">
        <td style="padding: 10px 12px; vertical-align: top;">
          <a href="${trend.trendsLink}" style="color: #60a5fa; text-decoration: none; font-weight: 500; font-size: 13px; line-height: 1.3;" target="_blank">${trend.query}</a>
          ${trend.trendBreakdown ? `<div style="color: #6b7280; font-size: 11px; margin-top: 4px; line-height: 1.3;">${trend.trendBreakdown}</div>` : ''}
        </td>
        <td style="padding: 10px 12px; text-align: center; color: #ffffff; font-weight: 600; font-size: 13px;">${volumeDisplay}</td>
        <td style="padding: 10px 12px; text-align: center; color: #10b981; font-weight: 600; font-size: 13px;">+${trend.increasePercentage}%</td>
        <td style="padding: 10px 12px; text-align: center;">
          <span style="background: ${statusBg}; color: ${statusColor}; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">${statusText}</span>
        </td>
        <td style="padding: 10px 12px; color: #d1d5db; font-size: 11px; line-height: 1.4;">${trend.categoriesDisplay}</td>
        <td style="padding: 10px 12px; color: #9ca3af; font-size: 11px;">${trend.timestamp}</td>
      </tr>`;
  });
  
  table += `</table>`;
  return table;
}

const reportTime = new Date().toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true
});
const totalBusinessTrends = processedPureTrends.length + processedMixedTrends.length;
const dataSource = (inputData[0].json.testData && inputData[0].json.testData.trim() !== '') ? 'TEST DATA' : 'LIVE API';

const summaryReportLink = `https://trends.google.com/trending?geo=${geoLocation}&category=3&hours=48`;

let emailBody = '';
let emailSubject = '';

if (totalBusinessTrends === 0) {
  emailSubject = `📊 No B&F Trends • ${geoLocation} • ${reportTime}`;
  emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Google Trends Monitor</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 800px; margin: 20px auto; background: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid #374151;">
        <tr>
          <td style="padding: 20px 24px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-bottom: 1px solid #374151;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td>
                  <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 20px; font-weight: 700;">📊 Google Trends Monitor</h1>
                  <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: 500;">TakeProfit SEO Team • ${dataSource} • ${reportTime}</p>
                </td>
                <td style="text-align: right;">
                  <a href="${summaryReportLink}" style="background: #0ea5e9; color: #ffffff; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;" target="_blank">View Trends Dashboard</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 24px; text-align: center;">
            <div style="background: #2d2d2d; border-radius: 8px; padding: 32px; border: 1px solid #374151;">
              <h2 style="margin: 0 0 8px 0; color: #f8fafc; font-size: 18px; font-weight: 600;">No Business & Finance Trends Found</h2>
              <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px;">Location: ${geoLocation}</p>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">Analyzed ${trendingSearches.length} total trending searches</p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>`;
} else {
  emailSubject = `📈 ${totalBusinessTrends} B&F Trends • ${geoLocation} • ${reportTime}`;
  emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Google Trends Report</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
      <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 900px; margin: 20px auto; background: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid #374151;">
        
        <!-- Header -->
        <tr>
          <td style="padding: 20px 24px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-bottom: 1px solid #374151;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td>
                  <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 20px; font-weight: 700;">📈 Google Trends Report</h1>
                  <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: 500;">TakeProfit SEO Team • ${dataSource} • ${reportTime}</p>
                </td>
                <td style="text-align: right;">
                  <a href="${summaryReportLink}" style="background: #0ea5e9; color: #ffffff; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;" target="_blank">View Trends Dashboard</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        
        <!-- Summary Stats -->
        <tr>
          <td style="padding: 16px 24px; background: #252525; border-bottom: 1px solid #374151;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td style="color: #ffffff; font-size: 16px; font-weight: 600;">
                  ${totalBusinessTrends} Business & Finance Trends • ${geoLocation}
                </td>
                <td style="text-align: right;">
                  <span style="background: #059669; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin: 0 4px;">Pure: ${processedPureTrends.length}</span>
                  <span style="background: #7c3aed; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin: 0 4px;">Mixed: ${processedMixedTrends.length}</span>
                  <span style="background: #374151; color: #d1d5db; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin: 0 4px;">Total: ${trendingSearches.length}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td style="padding: 16px 24px;">`;
  
  if (processedPureTrends.length > 0) {
    emailBody += formatTrendsTable(processedPureTrends, '🎯 Pure Business & Finance Trends', true);
  }
  
  if (processedMixedTrends.length > 0) {
    emailBody += formatTrendsTable(processedMixedTrends, '🔗 Mixed Category Trends', false);
  }
  
  emailBody += `
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="padding: 16px 24px; background: #252525; border-top: 1px solid #374151;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr>
                <td style="color: #9ca3af; font-size: 11px;">
                  <strong>Analysis Summary:</strong> Found ${totalBusinessTrends} B&F trends out of ${trendingSearches.length} total • Location: ${geoLocation} • Source: ${dataSource}
                </td>
                <td style="text-align: right;">
                  <a href="${summaryReportLink}" style="color: #60a5fa; font-size: 11px; text-decoration: none;" target="_blank">🔗 Google Trends Dashboard</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        
      </table>
    </body>
    </html>`;
}

console.log(`FINAL: Processed ${totalBusinessTrends} B&F trends from ${dataSource}`);
console.log(`Pure B&F: ${processedPureTrends.length}, Mixed: ${processedMixedTrends.length}`);
const excludedTrends = trendingSearches.length - totalBusinessTrends;
if (excludedTrends > 0) {
  console.log(`Excluded ${excludedTrends} non-B&F trends`);
}

return [{
  success: true,
  trendsFound: totalBusinessTrends,
  pureTrends: processedPureTrends.length,
  mixedTrends: processedMixedTrends.length,
  totalTrends: trendingSearches.length,
  emailBody: emailBody,
  emailSubject: emailSubject,
  rawData: [...processedPureTrends, ...processedMixedTrends],
  geoLocation: geoLocation,
  dataSource: dataSource
}];
