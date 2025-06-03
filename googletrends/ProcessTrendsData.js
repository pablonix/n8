// ProcessTrendsData.js - Основная логика обработки трендов
const inputData = $input.all();

// Получаем данные из предыдущих нод
const trendsData = inputData.find(item => item.json.processedTrends);
const existingData = inputData.filter(item => item.json.query && item.json.first_seen);
const aiResponse = inputData.find(item => item.json.choices || item.json.categorized_trends);

console.log(`Input data sources: trends=${!!trendsData}, existing=${existingData.length}, ai=${!!aiResponse}`);

if (!trendsData) {
  return [{
    success: false,
    error: 'No trends data found',
    emailBody: 'Error: No trends data received from previous nodes.'
  }];
}

// Создаем мапу существующих трендов
const existingTrends = new Map();
existingData.forEach(item => {
  if (item.json.query) {
    existingTrends.set(item.json.query.toLowerCase().trim(), item.json);
  }
});

console.log(`Found ${existingTrends.size} existing trends in Google Sheets`);

// Обрабатываем AI результаты если есть
let aiResults = {};
if (aiResponse) {
  try {
    if (aiResponse.json.choices?.[0]?.message?.content) {
      // OpenAI API response format
      aiResults = JSON.parse(aiResponse.json.choices[0].message.content);
    } else if (aiResponse.json.categorized_trends) {
      // Direct format
      aiResults = aiResponse.json;
    }
  } catch (e) {
    console.log('AI parsing error:', e.message);
    aiResults = {categorized_trends: []};
  }
}

const categorizedTrends = aiResults.categorized_trends || [];
const aiMap = new Map();
categorizedTrends.forEach(trend => {
  aiMap.set(trend.query.toLowerCase().trim(), {
    category: trend.category,
    confidence: trend.confidence,
    reasoning: trend.reasoning
  });
});

console.log(`AI categorized ${categorizedTrends.length} trends`);

// Обрабатываем каждый тренд
const currentTime = new Date().toISOString();
const allTrendsForSheets = [];
const newTrends = [];
const updatedTrends = [];

trendsData.json.processedTrends.forEach(newTrend => {
  const queryKey = newTrend.query.toLowerCase().trim();
  const existing = existingTrends.get(queryKey);
  const aiData = aiMap.get(queryKey);
  
  if (existing) {
    // Обновляем существующий тренд
    const updatedTrend = {
      ...existing,
      last_seen: currentTime,
      appearances_count: (parseInt(existing.appearances_count) || 0) + 1,
      current_volume: newTrend.search_volume,
      current_increase: newTrend.increase_percentage,
      max_volume: Math.max(parseInt(existing.max_volume) || 0, newTrend.search_volume),
      max_increase: Math.max(parseInt(existing.max_increase) || 0, newTrend.increase_percentage),
      trend_breakdown: newTrend.trend_breakdown,
      trends_link: newTrend.trends_link
    };
    
    // Обновляем AI данные если есть новые
    if (aiData) {
      updatedTrend.ai_category = aiData.category;
      updatedTrend.ai_confidence = aiData.confidence;
      updatedTrend.ai_reasoning = aiData.reasoning;
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
      current_volume: newTrend.search_volume,
      max_volume: newTrend.search_volume,
      current_increase: newTrend.increase_percentage,
      max_increase: newTrend.increase_percentage,
      ai_category: aiData ? aiData.category : '',
      ai_confidence: aiData ? aiData.confidence : '',
      ai_reasoning: aiData ? aiData.reasoning : '',
      manual_category: '',
      manual_status: 'pending',
      manual_comment: '',
      geo_location: newTrend.geo_location,
      trend_breakdown: newTrend.trend_breakdown,
      trends_link: newTrend.trends_link
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
const relevantInsights = allTrendsForSheets.filter(trend => 
  trend.ai_category && 
  trend.ai_category !== 'irrelevant' && 
  trend.manual_status !== 'irrelevant'
).sort((a, b) => {
  const priorityA = (a.current_volume / 1000) * (a.ai_confidence || 5);
  const priorityB = (b.current_volume / 1000) * (b.ai_confidence || 5);
  return priorityB - priorityA;
});

const newRelevantInsights = relevantInsights.filter(trend => 
  newTrends.some(newTrend => newTrend.query === trend.query)
);

// Статистика по категориям
const categoryStats = {hot_stocks: 0, hot_coins: 0, platforms: 0, tools: 0};
relevantInsights.forEach(trend => {
  if (categoryStats[trend.ai_category] !== undefined) {
    categoryStats[trend.ai_category]++;
  }
});

// Создаем данные для AI обработки (только новые тренды без категории)
const trendsForAI = newTrends.filter(trend => !trend.ai_category);
const needsAI = trendsForAI.length > 0;

const aiPrompt = needsAI ? 
  `Analyze these trending search terms for TakeProfit.com trading platform. Categorize as:
- "hot_stocks": Stock tickers, companies
- "hot_coins": Cryptocurrencies  
- "platforms": Trading/financial platforms
- "tools": Trading tools, indicators, strategies
- "irrelevant": Not trading-related

Terms to analyze:
${trendsForAI.map(t => `"${t.query}" (${t.current_volume} searches, +${t.current_increase}%)`).join('\n')}

Respond in JSON: {"categorized_trends": [{"query": "term", "category": "hot_stocks", "confidence": 8, "reasoning": "explanation"}]}` 
  : '';

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
  dataSource: trendsData.json.dataSource || 'LIVE',
  currentTimestamp: currentTime
}];
