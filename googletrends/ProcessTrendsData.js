// ProcessTrendsData.js - Исправленная версия с лучшей обработкой данных
const inputData = $input.all();

console.log(`ProcessTrendsData: Received ${inputData.length} input items`);

// Находим данные из разных нод
const trendsData = inputData.find(item => 
  item.json && (item.json.processedTrends || item.json.success === true)
);

const existingData = inputData.filter(item => 
  item.json && item.json.query && item.json.first_seen
);

const aiResponse = inputData.find(item => 
  item.json && (item.json.choices || item.json.categorized_trends)
);

console.log(`Data sources found: trends=${!!trendsData}, existing=${existingData.length}, ai=${!!aiResponse}`);

// Проверяем наличие основных данных трендов
if (!trendsData || !trendsData.json || !trendsData.json.success) {
  console.log('No valid trends data found');
  return [{
    success: false,
    error: 'No valid trends data found from previous nodes',
    emailBody: 'Error: No trends data received from Filter B&F Trends node.'
  }];
}

// Получаем обработанные тренды
const processedTrends = trendsData.json.processedTrends || [];
console.log(`Found ${processedTrends.length} processed trends`);

// Если нет трендов для обработки
if (processedTrends.length === 0) {
  console.log('No trends to process');
  return [{
    success: true,
    allTrendsForSheets: [],
    newTrends: [],
    updatedTrends: [],
    relevantInsights: [],
    newRelevantInsights: [],
    categoryStats: {hot_stocks: 0, hot_coins: 0, platforms: 0, tools: 0},
    trendsForAI: [],
    aiPrompt: '',
    needsAI: false,
    newTrendsCount: 0,
    updatedTrendsCount: 0,
    totalProcessed: 0,
    geoLocation: trendsData.json.geoLocation || 'US',
    dataSource: trendsData.json.dataSource || 'API',
    currentTimestamp: new Date().toISOString()
  }];
}

// Создаем мапу существующих трендов из Google Sheets
const existingTrends = new Map();
existingData.forEach(item => {
  if (item.json && item.json.query) {
    const key = item.json.query.toLowerCase().trim();
    existingTrends.set(key, item.json);
  }
});

console.log(`Found ${existingTrends.size} existing trends in Google Sheets`);

// Обрабатываем AI результаты если есть
let aiResults = {categorized_trends: []};
if (aiResponse && aiResponse.json) {
  try {
    if (aiResponse.json.choices && aiResponse.json.choices[0]) {
      // OpenAI API response format
      const content = aiResponse.json.choices[0].message.content;
      aiResults = JSON.parse(content);
    } else if (aiResponse.json.categorized_trends) {
      // Direct format
      aiResults = aiResponse.json;
    }
    console.log(`AI categorized ${aiResults.categorized_trends.length} trends`);
  } catch (e) {
    console.log('AI parsing error:', e.message);
    aiResults = {categorized_trends: []};
  }
}

// Создаем мапу AI результатов
const aiMap = new Map();
(aiResults.categorized_trends || []).forEach(trend => {
  if (trend.query) {
    aiMap.set(trend.query.toLowerCase().trim(), {
      category: trend.category,
      confidence: trend.confidence,
      reasoning: trend.reasoning
    });
  }
});

// Обрабатываем каждый тренд
const currentTime = new Date().toISOString();
const allTrendsForSheets = [];
const newTrends = [];
const updatedTrends = [];

processedTrends.forEach(newTrend => {
  if (!newTrend.query) return; // Пропускаем тренды без query
  
  const queryKey = newTrend.query.toLowerCase().trim();
  const existing = existingTrends.get(queryKey);
  const aiData = aiMap.get(queryKey);
  
  if (existing) {
    // Обновляем существующий тренд
    const updatedTrend = {
      ...existing,
      last_seen: currentTime,
      appearances_count: (parseInt(existing.appearances_count) || 0) + 1,
      current_volume: newTrend.search_volume || 0,
      current_increase: newTrend.increase_percentage || 0,
      max_volume: Math.max(parseInt(existing.max_volume) || 0, newTrend.search_volume || 0),
      max_increase: Math.max(parseInt(existing.max_increase) || 0, newTrend.increase_percentage || 0),
      trend_breakdown: newTrend.trend_breakdown || '',
      trends_link: newTrend.trends_link || '',
      geo_location: newTrend.geo_location || existing.geo_location
    };
    
    // Обновляем AI данные если есть новые
    if (aiData) {
      updatedTrend.ai_category = aiData.category || '';
      updatedTrend.ai_confidence = aiData.confidence || '';
      updatedTrend.ai_reasoning = aiData.reasoning || '';
    }
    
    allTrendsForSheets.push(updatedTrend);
    updatedTrends.push(updatedTrend);
  } else {
    // Новый тренд
    const newTrendData = {
      query: queryKey,
      first_seen: currentTime,
      last_seen: currentTime,
      appearances_count: 1,
      current_volume: newTrend.search_volume || 0,
      max_volume: newTrend.search_volume || 0,
      current_increase: newTrend.increase_percentage || 0,
      max_increase: newTrend.increase_percentage || 0,
      ai_category: aiData ? (aiData.category || '') : '',
      ai_confidence: aiData ? (aiData.confidence || '') : '',
      ai_reasoning: aiData ? (aiData.reasoning || '') : '',
      manual_category: '',
      manual_status: 'pending',
      manual_comment: '',
      geo_location: newTrend.geo_location || 'US',
      trend_breakdown: newTrend.trend_breakdown || '',
      trends_link: newTrend.trends_link || ''
    };
    
    allTrendsForSheets.push(newTrendData);
    newTrends.push(newTrendData);
  }
});

// Добавляем существующие тренды которые не были обновлены
existingTrends.forEach((trend, query) => {
  const wasUpdated = allTrendsForSheets.some(t => t.query === query);
  if (!wasUpdated) {
    allTrendsForSheets.push(trend);
  }
});

// Определяем релевантные инсайты
const relevantInsights = allTrendsForSheets.filter(trend => {
  return trend.ai_category && 
         trend.ai_category !== 'irrelevant' && 
         trend.manual_status !== 'irrelevant';
}).sort((a, b) => {
  const priorityA = (parseInt(a.current_volume) || 0) / 1000 * (parseInt(a.ai_confidence) || 5);
  const priorityB = (parseInt(b.current_volume) || 0) / 1000 * (parseInt(b.ai_confidence) || 5);
  return priorityB - priorityA;
});

const newRelevantInsights = relevantInsights.filter(trend => 
  newTrends.some(newTrend => newTrend.query === trend.query)
);

// Статистика по категориям
const categoryStats = {hot_stocks: 0, hot_coins: 0, platforms: 0, tools: 0};
relevantInsights.forEach(trend => {
  if (categoryStats.hasOwnProperty(trend.ai_category)) {
    categoryStats[trend.ai_category]++;
  }
});

// Создаем данные для AI обработки (только новые тренды без категории)
const trendsForAI = newTrends.filter(trend => !trend.ai_category);
const needsAI = trendsForAI.length > 0;

let aiPrompt = '';
if (needsAI) {
  aiPrompt = `Analyze these trending search terms for TakeProfit.com trading platform. Categorize as:
- "hot_stocks": Stock tickers, companies
- "hot_coins": Cryptocurrencies  
- "platforms": Trading/financial platforms
- "tools": Trading tools, indicators, strategies
- "irrelevant": Not trading-related

Terms to analyze:
${trendsForAI.map(t => `"${t.query}" (${t.current_volume} searches, +${t.current_increase}%)`).join('\n')}

Respond in JSON: {"categorized_trends": [{"query": "term", "category": "hot_stocks", "confidence": 8, "reasoning": "explanation"}]}`;
}

console.log(`Processing complete: ${allTrendsForSheets.length} total, ${newTrends.length} new, ${updatedTrends.length} updated, ${relevantInsights.length} relevant`);

// Возвращаем результат
return [{
  success: true,
  
  // Данные для Google Sheets
  allTrendsForSheets: allTrendsForSheets,
  
  // Данные для email
  newTrends: newTrends,
  updatedTrends: updatedTrends,
  relevantInsights: relevantInsights,
  newRelevantInsights: newRelevantInsights,
  categoryStats: categoryStats,
  
  // Данные для AI обработки
  trendsForAI: trendsForAI,
  aiPrompt: aiPrompt,
  needsAI: needsAI,
  
  // Метаданные
  newTrendsCount: newTrends.length,
  updatedTrendsCount: updatedTrends.length,
  totalProcessed: allTrendsForSheets.length,
  geoLocation: trendsData.json.geoLocation || 'US',
  dataSource: trendsData.json.dataSource || 'API',
  currentTimestamp: currentTime
}];
